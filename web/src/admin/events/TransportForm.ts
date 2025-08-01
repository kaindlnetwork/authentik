import "#components/ak-hidden-text-input";
import "#elements/forms/HorizontalFormElement";
import "#elements/forms/Radio";
import "#elements/forms/SearchSelect/index";

import { DEFAULT_CONFIG } from "#common/api/config";

import { ModelForm } from "#elements/forms/ModelForm";

import {
    EventsApi,
    NotificationTransport,
    NotificationTransportModeEnum,
    NotificationWebhookMapping,
    PropertymappingsApi,
    PropertymappingsNotificationListRequest,
} from "@goauthentik/api";

import { msg } from "@lit/localize";
import { html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

@customElement("ak-event-transport-form")
export class TransportForm extends ModelForm<NotificationTransport, string> {
    loadInstance(pk: string): Promise<NotificationTransport> {
        return new EventsApi(DEFAULT_CONFIG)
            .eventsTransportsRetrieve({
                uuid: pk,
            })
            .then((transport) => {
                this.onModeChange(transport.mode);
                return transport;
            });
    }

    @property({ type: Boolean })
    showWebhook = false;

    getSuccessMessage(): string {
        return this.instance
            ? msg("Successfully updated transport.")
            : msg("Successfully created transport.");
    }

    async send(data: NotificationTransport): Promise<NotificationTransport> {
        if (this.instance) {
            return new EventsApi(DEFAULT_CONFIG).eventsTransportsUpdate({
                uuid: this.instance.pk || "",
                notificationTransportRequest: data,
            });
        }
        return new EventsApi(DEFAULT_CONFIG).eventsTransportsCreate({
            notificationTransportRequest: data,
        });
    }

    onModeChange(mode: string | undefined): void {
        if (
            mode === NotificationTransportModeEnum.Webhook ||
            mode === NotificationTransportModeEnum.WebhookSlack
        ) {
            this.showWebhook = true;
        } else {
            this.showWebhook = false;
        }
    }

    renderForm(): TemplateResult {
        return html` <ak-form-element-horizontal label=${msg("Name")} required name="name">
                <input
                    type="text"
                    value="${ifDefined(this.instance?.name)}"
                    class="pf-c-form-control"
                    required
                />
            </ak-form-element-horizontal>
            <ak-form-element-horizontal label=${msg("Mode")} required name="mode">
                <ak-radio
                    @change=${(ev: CustomEvent<{ value: NotificationTransportModeEnum }>) => {
                        this.onModeChange(ev.detail.value);
                    }}
                    .options=${[
                        {
                            label: msg("Local (notifications will be created within authentik)"),
                            value: NotificationTransportModeEnum.Local,
                            default: true,
                        },
                        {
                            label: msg("Email"),
                            value: NotificationTransportModeEnum.Email,
                        },
                        {
                            label: msg("Webhook (generic)"),
                            value: NotificationTransportModeEnum.Webhook,
                        },
                        {
                            label: msg("Webhook (Slack/Discord)"),
                            value: NotificationTransportModeEnum.WebhookSlack,
                        },
                    ]}
                    .value=${this.instance?.mode}
                >
                </ak-radio>
            </ak-form-element-horizontal>
            <ak-hidden-text-input
                name="webhookUrl"
                label=${msg("Webhook URL")}
                value="${this.instance?.webhookUrl || ""}"
                input-hint="code"
                ?hidden=${!this.showWebhook}
                required
            >
            </ak-hidden-text-input>
            <ak-form-element-horizontal
                ?hidden=${!this.showWebhook}
                label=${msg("Webhook Body Mapping")}
                name="webhookMappingBody"
            >
                <ak-search-select
                    .fetchObjects=${async (
                        query?: string,
                    ): Promise<NotificationWebhookMapping[]> => {
                        const args: PropertymappingsNotificationListRequest = {
                            ordering: "name",
                        };
                        if (query !== undefined) {
                            args.search = query;
                        }
                        const items = await new PropertymappingsApi(
                            DEFAULT_CONFIG,
                        ).propertymappingsNotificationList(args);
                        return items.results;
                    }}
                    .renderElement=${(item: NotificationWebhookMapping): string => {
                        return item.name;
                    }}
                    .value=${(item: NotificationWebhookMapping | undefined): string | undefined => {
                        return item?.pk;
                    }}
                    .selected=${(item: NotificationWebhookMapping): boolean => {
                        return this.instance?.webhookMappingBody === item.pk;
                    }}
                    blankable
                >
                </ak-search-select>
            </ak-form-element-horizontal>
            <ak-form-element-horizontal
                ?hidden=${!this.showWebhook}
                label=${msg("Webhook Header Mapping")}
                name="webhookMappingHeaders"
            >
                <ak-search-select
                    .fetchObjects=${async (
                        query?: string,
                    ): Promise<NotificationWebhookMapping[]> => {
                        const args: PropertymappingsNotificationListRequest = {
                            ordering: "name",
                        };
                        if (query !== undefined) {
                            args.search = query;
                        }
                        const items = await new PropertymappingsApi(
                            DEFAULT_CONFIG,
                        ).propertymappingsNotificationList(args);
                        return items.results;
                    }}
                    .renderElement=${(item: NotificationWebhookMapping): string => {
                        return item.name;
                    }}
                    .value=${(item: NotificationWebhookMapping | undefined): string | undefined => {
                        return item?.pk;
                    }}
                    .selected=${(item: NotificationWebhookMapping): boolean => {
                        return this.instance?.webhookMappingHeaders === item.pk;
                    }}
                    blankable
                >
                </ak-search-select>
            </ak-form-element-horizontal>
            <ak-form-element-horizontal name="sendOnce">
                <label class="pf-c-switch">
                    <input
                        class="pf-c-switch__input"
                        type="checkbox"
                        ?checked=${this.instance?.sendOnce ?? false}
                    />
                    <span class="pf-c-switch__toggle">
                        <span class="pf-c-switch__toggle-icon">
                            <i class="fas fa-check" aria-hidden="true"></i>
                        </span>
                    </span>
                    <span class="pf-c-switch__label">${msg("Send once")}</span>
                </label>
                <p class="pf-c-form__helper-text">
                    ${msg(
                        "Only send notification once, for example when sending a webhook into a chat channel.",
                    )}
                </p>
            </ak-form-element-horizontal>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "ak-event-transport-form": TransportForm;
    }
}
