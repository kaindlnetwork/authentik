"""authentik redirect stage"""

from urllib.parse import urlsplit

from django.http.response import HttpResponse
from rest_framework.fields import CharField
from structlog.stdlib import get_logger

from authentik.flows.challenge import (
    Challenge,
    ChallengeResponse,
    RedirectChallenge,
)
from authentik.flows.exceptions import StageInvalidException
from authentik.flows.models import (
    Flow,
)
from authentik.flows.stage import ChallengeStageView
from authentik.stages.redirect.models import RedirectStage

LOGGER = get_logger()
PLAN_CONTEXT_REDIRECT_STAGE_TARGET = "redirect_stage_target"
URL_SCHEME_FLOW = "ak-flow"


class RedirectChallengeResponse(ChallengeResponse):
    """Redirect challenge response"""

    component = CharField(default="xak-flow-redirect")


class RedirectStageView(ChallengeStageView):
    """Redirect stage for testing with multiple stages"""

    response_class = RedirectChallengeResponse

    def challenge_valid(self, response: ChallengeResponse) -> HttpResponse:
        return self.executor.stage_ok()

    def parse_target(self, target: str) -> str | Flow:
        parsed_target = urlsplit(target)

        if parsed_target.scheme == URL_SCHEME_FLOW:
            flow = Flow.objects.filter(slug=parsed_target.path).first()
            if not flow:
                LOGGER.warning(
                    f"{PLAN_CONTEXT_REDIRECT_STAGE_TARGET}={target} is present in plan context, "
                    f"but a Flow with that slug could not be found. Continuing as if "
                    f"{PLAN_CONTEXT_REDIRECT_STAGE_TARGET} was not set."
                )
            return ""
        return target

    def get_challenge(self, *args, **kwargs) -> Challenge:
        # The redirect target is selected by the following priority:
        #
        # 1. `redirect_stage_target`
        # 2. `current_stage.target_static`
        # 3. `current_stage.target_flow`
        #
        # If none of these are found, raise `StageInvalidException`.

        current_stage: RedirectStage = self.executor.current_stage
        target: str | Flow = ""

        target_url_override = self.executor.plan.context.get(PLAN_CONTEXT_REDIRECT_STAGE_TARGET, "")
        if target_url_override:
            target = self.parse_target(target_url_override)
        if not target:
            target = current_stage.target_static or current_stage.target_flow

        if isinstance(target, str):
            redirect_to = target
        else:
            redirect_to = self.executor.switch_flow_with_context(
                target, keep_context=current_stage.keep_context
            )

        if not redirect_to:
            raise StageInvalidException(
                "No target found for Redirect stage. The stage's target_flow may have been deleted."
            )

        return RedirectChallenge(
            data={
                "component": "xak-flow-redirect",
                "to": redirect_to,
            }
        )
