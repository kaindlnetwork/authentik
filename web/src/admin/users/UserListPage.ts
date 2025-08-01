import "#admin/users/ServiceAccountForm";
import "#admin/users/UserActiveForm";
import "#admin/users/UserForm";
import "#admin/users/UserImpersonateForm";
import "#admin/users/UserPasswordForm";
import "#admin/users/UserResetEmailForm";
import "#components/ak-status-label";
import "#elements/TreeView";
import "#elements/buttons/ActionButton/index";
import "#elements/forms/DeleteBulkForm";
import "#elements/forms/ModalForm";
import "@patternfly/elements/pf-tooltip/pf-tooltip.js";

import { DEFAULT_CONFIG } from "#common/api/config";
import { PFSize } from "#common/enums";
import { parseAPIResponseError } from "#common/errors/network";
import { userTypeToLabel } from "#common/labels";
import { MessageLevel } from "#common/messages";
import { formatElapsedTime } from "#common/temporal";
import { rootInterface } from "#common/theme";
import { DefaultUIConfig, uiConfig } from "#common/ui/config";
import { me } from "#common/users";

import { showAPIErrorMessage, showMessage } from "#elements/messages/MessageContainer";
import { WithBrandConfig } from "#elements/mixins/branding";
import { CapabilitiesEnum, WithCapabilitiesConfig } from "#elements/mixins/capabilities";
import { getURLParam, updateURLParams } from "#elements/router/RouteMatch";
import { PaginatedResponse, TableColumn } from "#elements/table/Table";
import { TablePage } from "#elements/table/TablePage";
import { writeToClipboard } from "#elements/utils/writeToClipboard";

import type { AdminInterface } from "#admin/AdminInterface/index.entrypoint";

import { CoreApi, SessionUser, User, UserPath } from "@goauthentik/api";

import { msg, str } from "@lit/localize";
import { css, CSSResult, html, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

import PFAlert from "@patternfly/patternfly/components/Alert/alert.css";
import PFCard from "@patternfly/patternfly/components/Card/card.css";
import PFDescriptionList from "@patternfly/patternfly/components/DescriptionList/description-list.css";

export const requestRecoveryLink = (user: User) =>
    new CoreApi(DEFAULT_CONFIG)
        .coreUsersRecoveryCreate({
            id: user.pk,
        })
        .then((rec) =>
            writeToClipboard(rec.link).then((wroteToClipboard) =>
                showMessage({
                    level: MessageLevel.success,
                    message: rec.link,
                    description: wroteToClipboard
                        ? msg("A copy of this recovery link has been placed in your clipboard")
                        : "",
                }),
            ),
        )
        .catch((error: unknown) => parseAPIResponseError(error).then(showAPIErrorMessage));

export const renderRecoveryEmailRequest = (user: User) =>
    html`<ak-forms-modal .closeAfterSuccessfulSubmit=${false} id="ak-email-recovery-request">
        <span slot="submit"> ${msg("Send link")} </span>
        <span slot="header"> ${msg("Send recovery link to user")} </span>
        <ak-user-reset-email-form slot="form" .user=${user}> </ak-user-reset-email-form>
        <button slot="trigger" class="pf-c-button pf-m-secondary">
            ${msg("Email recovery link")}
        </button>
    </ak-forms-modal>`;

const recoveryButtonStyles = css`
    #recovery-request-buttons {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.375rem;
    }
    #recovery-request-buttons > *,
    #update-password-request .pf-c-button {
        margin: 0;
    }
`;

@customElement("ak-user-list")
export class UserListPage extends WithBrandConfig(WithCapabilitiesConfig(TablePage<User>)) {
    expandable = true;
    checkbox = true;
    clearOnRefresh = true;
    supportsQL = true;

    searchEnabled(): boolean {
        return true;
    }
    pageTitle(): string {
        return msg("Users");
    }
    pageDescription(): string {
        return "";
    }
    pageIcon(): string {
        return "pf-icon pf-icon-user";
    }

    @property()
    order = "last_login";

    @property()
    activePath;

    @state()
    hideDeactivated = getURLParam<boolean>("hideDeactivated", false);

    @state()
    userPaths?: UserPath;

    @state()
    me?: SessionUser;

    static styles: CSSResult[] = [
        ...TablePage.styles,
        PFDescriptionList,
        PFCard,
        PFAlert,
        recoveryButtonStyles,
    ];

    constructor() {
        super();
        const defaultPath = new DefaultUIConfig().defaults.userPath;
        this.activePath = getURLParam<string>("path", defaultPath);
        uiConfig().then((c) => {
            if (c.defaults.userPath !== defaultPath) {
                this.activePath = c.defaults.userPath;
            }
        });
    }

    async apiEndpoint(): Promise<PaginatedResponse<User>> {
        const users = await new CoreApi(DEFAULT_CONFIG).coreUsersList({
            ...(await this.defaultEndpointConfig()),
            pathStartswith: this.activePath,
            isActive: this.hideDeactivated ? true : undefined,
            includeGroups: false,
        });
        this.userPaths = await new CoreApi(DEFAULT_CONFIG).coreUsersPathsRetrieve({
            search: this.search,
        });
        this.me = await me();
        return users;
    }

    columns(): TableColumn[] {
        return [
            new TableColumn(msg("Name"), "username"),
            new TableColumn(msg("Active"), "is_active"),
            new TableColumn(msg("Last login"), "last_login"),
            new TableColumn(msg("Type"), "type"),
            new TableColumn(msg("Actions")),
        ];
    }

    renderToolbarSelected(): TemplateResult {
        const disabled = this.selectedElements.length < 1;
        const currentUser = rootInterface<AdminInterface>()?.user;
        const shouldShowWarning = this.selectedElements.find((el) => {
            return el.pk === currentUser?.user.pk || el.pk === currentUser?.original?.pk;
        });
        return html`<ak-forms-delete-bulk
            objectLabel=${msg("User(s)")}
            .objects=${this.selectedElements}
            .metadata=${(item: User) => {
                return [
                    { key: msg("Username"), value: item.username },
                    { key: msg("ID"), value: item.pk.toString() },
                    { key: msg("UID"), value: item.uid },
                ];
            }}
            .usedBy=${(item: User) => {
                return new CoreApi(DEFAULT_CONFIG).coreUsersUsedByList({
                    id: item.pk,
                });
            }}
            .delete=${(item: User) => {
                return new CoreApi(DEFAULT_CONFIG).coreUsersDestroy({
                    id: item.pk,
                });
            }}
        >
            ${shouldShowWarning
                ? html`<div slot="notice" class="pf-c-form__alert">
                      <div class="pf-c-alert pf-m-inline pf-m-warning">
                          <div class="pf-c-alert__icon">
                              <i class="fas fa-exclamation-circle"></i>
                          </div>
                          <h4 class="pf-c-alert__title">
                              ${msg(
                                  str`Warning: You're about to delete the user you're logged in as (${shouldShowWarning.username}). Proceed at your own risk.`,
                              )}
                          </h4>
                      </div>
                  </div>`
                : html``}
            <button ?disabled=${disabled} slot="trigger" class="pf-c-button pf-m-danger">
                ${msg("Delete")}
            </button>
        </ak-forms-delete-bulk>`;
    }

    renderToolbarAfter(): TemplateResult {
        return html`&nbsp;
            <div class="pf-c-toolbar__group pf-m-filter-group">
                <div class="pf-c-toolbar__item pf-m-search-filter">
                    <div class="pf-c-input-group">
                        <label class="pf-c-switch">
                            <input
                                class="pf-c-switch__input"
                                type="checkbox"
                                ?checked=${this.hideDeactivated}
                                @change=${() => {
                                    this.hideDeactivated = !this.hideDeactivated;
                                    this.page = 1;
                                    this.fetch();
                                    updateURLParams({
                                        hideDeactivated: this.hideDeactivated,
                                    });
                                }}
                            />
                            <span class="pf-c-switch__toggle">
                                <span class="pf-c-switch__toggle-icon">
                                    <i class="fas fa-check" aria-hidden="true"></i>
                                </span>
                            </span>
                            <span class="pf-c-switch__label">${msg("Hide deactivated user")}</span>
                        </label>
                    </div>
                </div>
            </div>`;
    }

    row(item: User): TemplateResult[] {
        const canImpersonate =
            this.can(CapabilitiesEnum.CanImpersonate) && item.pk !== this.me?.user.pk;
        return [
            html`<a href="#/identity/users/${item.pk}">
                <div>${item.username}</div>
                <small>${item.name ? item.name : html`&lt;${msg("No name set")}&gt;`}</small>
            </a>`,
            html`<ak-status-label ?good=${item.isActive}></ak-status-label>`,
            html`${item.lastLogin
                ? html`<div>${formatElapsedTime(item.lastLogin)}</div>
                      <small>${item.lastLogin.toLocaleString()}</small>`
                : msg("-")}`,
            html`${userTypeToLabel(item.type)}`,
            html`<ak-forms-modal>
                    <span slot="submit"> ${msg("Update")} </span>
                    <span slot="header"> ${msg("Update User")} </span>
                    <ak-user-form slot="form" .instancePk=${item.pk}> </ak-user-form>
                    <button slot="trigger" class="pf-c-button pf-m-plain">
                        <pf-tooltip position="top" content=${msg("Edit")}>
                            <i class="fas fa-edit"></i>
                        </pf-tooltip>
                    </button>
                </ak-forms-modal>
                ${canImpersonate
                    ? html`
                          <ak-forms-modal size=${PFSize.Medium} id="impersonate-request">
                              <span slot="submit">${msg("Impersonate")}</span>
                              <span slot="header">${msg("Impersonate")} ${item.username}</span>
                              <ak-user-impersonate-form
                                  slot="form"
                                  .instancePk=${item.pk}
                              ></ak-user-impersonate-form>
                              <button slot="trigger" class="pf-c-button pf-m-tertiary">
                                  <pf-tooltip
                                      position="top"
                                      content=${msg("Temporarily assume the identity of this user")}
                                  >
                                      <span>${msg("Impersonate")}</span>
                                  </pf-tooltip>
                              </button>
                          </ak-forms-modal>
                      `
                    : html``}`,
        ];
    }

    renderExpanded(item: User): TemplateResult {
        return html`<td role="cell" colspan="3">
                <div class="pf-c-table__expandable-row-content">
                    <dl class="pf-c-description-list pf-m-horizontal">
                        <div class="pf-c-description-list__group">
                            <dt class="pf-c-description-list__term">
                                <span class="pf-c-description-list__text"
                                    >${msg("User status")}</span
                                >
                            </dt>
                            <dd class="pf-c-description-list__description">
                                <div class="pf-c-description-list__text">
                                    ${item.isActive ? msg("Active") : msg("Inactive")}
                                </div>
                                <div class="pf-c-description-list__text">
                                    ${item.isSuperuser ? msg("Superuser") : msg("Regular user")}
                                </div>
                            </dd>
                        </div>
                        <div class="pf-c-description-list__group">
                            <dt class="pf-c-description-list__term">
                                <span class="pf-c-description-list__text"
                                    >${msg("Change status")}</span
                                >
                            </dt>
                            <dd class="pf-c-description-list__description">
                                <div class="pf-c-description-list__text">
                                    <ak-user-active-form
                                        .obj=${item}
                                        objectLabel=${msg("User")}
                                        .delete=${() => {
                                            return new CoreApi(
                                                DEFAULT_CONFIG,
                                            ).coreUsersPartialUpdate({
                                                id: item.pk,
                                                patchedUserRequest: {
                                                    isActive: !item.isActive,
                                                },
                                            });
                                        }}
                                    >
                                        <button slot="trigger" class="pf-c-button pf-m-warning">
                                            ${item.isActive ? msg("Deactivate") : msg("Activate")}
                                        </button>
                                    </ak-user-active-form>
                                </div>
                            </dd>
                        </div>
                        <div class="pf-c-description-list__group">
                            <dt class="pf-c-description-list__term">
                                <span class="pf-c-description-list__text">${msg("Recovery")}</span>
                            </dt>
                            <dd class="pf-c-description-list__description">
                                <div
                                    class="pf-c-description-list__text"
                                    id="recovery-request-buttons"
                                >
                                    <ak-forms-modal
                                        size=${PFSize.Medium}
                                        id="update-password-request"
                                    >
                                        <span slot="submit">${msg("Update password")}</span>
                                        <span slot="header">
                                            ${msg(
                                                str`Update ${item.name || item.username}'s password`,
                                            )}
                                        </span>
                                        <ak-user-password-form
                                            username=${item.username}
                                            email=${ifDefined(item.email)}
                                            slot="form"
                                            .instancePk=${item.pk}
                                        ></ak-user-password-form>
                                        <button slot="trigger" class="pf-c-button pf-m-secondary">
                                            ${msg("Set password")}
                                        </button>
                                    </ak-forms-modal>
                                    ${this.brand.flowRecovery
                                        ? html`
                                              <ak-action-button
                                                  class="pf-m-secondary"
                                                  .apiRequest=${() => requestRecoveryLink(item)}
                                              >
                                                  ${msg("Create recovery link")}
                                              </ak-action-button>
                                              ${item.email
                                                  ? renderRecoveryEmailRequest(item)
                                                  : html`<span
                                                        >${msg(
                                                            "Recovery link cannot be emailed, user has no email address saved.",
                                                        )}</span
                                                    >`}
                                          `
                                        : html` <p>
                                              ${msg(
                                                  "To let a user directly reset their password, configure a recovery flow on the currently active brand.",
                                              )}
                                          </p>`}
                                </div>
                            </dd>
                        </div>
                    </dl>
                </div>
            </td>
            <td></td>
            <td></td>`;
    }

    renderObjectCreate(): TemplateResult {
        return html`
            <ak-forms-modal>
                <span slot="submit"> ${msg("Create")} </span>
                <span slot="header"> ${msg("Create User")} </span>
                <ak-user-form defaultPath=${this.activePath} slot="form"> </ak-user-form>
                <button slot="trigger" class="pf-c-button pf-m-primary">${msg("Create")}</button>
            </ak-forms-modal>
            <ak-forms-modal .closeAfterSuccessfulSubmit=${false} .cancelText=${msg("Close")}>
                <span slot="submit"> ${msg("Create")} </span>
                <span slot="header"> ${msg("Create Service account")} </span>
                <ak-user-service-account-form slot="form"> </ak-user-service-account-form>
                <button slot="trigger" class="pf-c-button pf-m-secondary">
                    ${msg("Create Service account")}
                </button>
            </ak-forms-modal>
        `;
    }

    protected renderSidebarBefore(): TemplateResult {
        return html`<div class="pf-c-sidebar__panel pf-m-width-25">
            <div class="pf-c-card">
                <div class="pf-c-card__title">${msg("User folders")}</div>
                <div class="pf-c-card__body">
                    <ak-treeview
                        .items=${this.userPaths?.paths || []}
                        activePath=${this.activePath}
                        @ak-refresh=${(ev: CustomEvent<{ path: string }>) => {
                            this.activePath = ev.detail.path;
                        }}
                    ></ak-treeview>
                </div>
            </div>
        </div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "ak-user-list": UserListPage;
    }
}
