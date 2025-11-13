const { createApp, ref, onMounted, nextTick, reactive } = Vue;
const { createVuetify, useTheme, useDisplay } = Vuetify;

(async () => {
    const api_version = ref('');

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const app = createApp({
        setup() {
            const theme   = useTheme();
            const display = useDisplay();

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            const snackbar_visible = ref(false);
            const snackbar_message = ref('');
            const snackbar_color   = ref('');
            const snackbar_time    = ref(5000);

            const snackbar = (message = null, color = null, time = null) => {
                if(!snackbar_visible.value) {
                    snackbar_message.value = message ?? snackbar_message.value;
                    snackbar_color.value   = color   ?? snackbar_color.value;
                    snackbar_time.value    = time    ?? snackbar_time.value;
                    snackbar_visible.value = true;
                }
            };

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            const dialog_loading_visible = ref(false);
            const dialog_loading_title   = ref('');
            const dialog_loading_icon    = ref('');

            const dialog_loading = (title = null, icon = null) => {
                if(!dialog_loading_visible.value) {
                    dialog_loading_title.value   = title ?? dialog_loading_title.value;
                    dialog_loading_icon.value    = icon  ?? dialog_loading_icon.value;
                    dialog_loading_visible.value = true;
                }
            };

            const dialog_settings_visible = ref(false);

            const dialog_settings = async (cmd = '') => {
                if(!dialog_settings_visible.value) {
                    dialog_settings_visible.value = true;

                    try {
                        if(!api_version.value) api_version.value = await api.call({ method: 'version' });
                    } catch(e) {
                        console.error(e);
                    }

                    return;
                }

                switch(cmd) {
                    case 'execute-update': {
                        dialog_loading('更新中...', 'mdi-lightning-bolt');

                        if((await fetchApps()).length <= 0) snackbar('サーバー上にアプリがありません');

                        dialog_loading_visible.value = false;

                        snackbar('更新が完了しました', 'success');

                        break;
                    }
                }
            };

            const password = ref('');
            const command  = ref('');
            const app_id   = ref(null);

            const dialog_operate_visible        = ref(false);
            const dialog_operate_select_value_1 = ref(null);
            const dialog_operate_select_value_2 = ref(null);

            const dialog_operate = () => {
                if(!dialog_operate_visible.value) {
                    dialog_operate_visible.value = true;

                    return;
                }

                const app = apps.value.find(app => app.name === dialog_operate_select_value_1.value);

                if(!app) return;

                let cmd;

                switch(dialog_operate_select_value_2.value) {
                    case '起動':
                        cmd = 'launch';
                        break;

                    case '停止':
                        cmd = 'stop';
                        break;

                    case '更新':
                        cmd = 'update';
                        break;

                    default:
                        return;
                }

                dialog_confirm(app.id, cmd);
            };

            const dialog_confirm_visible = ref(false);

            const dialog_confirm = async (id = null, cmd = null) => {
                if(id && cmd) {
                    app_id.value  = id;
                    command.value = cmd;
                }

                if(!password.value) {
                    dialog_password_input();

                    return;
                }

                if(!dialog_confirm_visible.value) {
                    dialog_confirm_visible.value = true;

                    return;
                }

                try {
                    dialog_confirm_visible.value = false;

                    dialog_loading('リクエスト中...', 'mdi-lightning-bolt');

                    let params = {
                        password: password.value,
                        app_id: app_id.value,
                        command: command.value
                    };

                    await api.call({ class: 'server', method: 'app-operate', params: params });

                    snackbar('成功しました', 'success');

                    dialog_operate_visible.value = false;

                    await fetchApps();
                } catch(e) {
                    switch(e.message) {
                        case 'api-call-result: failed - not-executable': {
                            e = '失敗: リクエストが拒否されました';
                            break;
                        }

                        default: {
                            console.error(e);
                            break;
                        }
                    }

                    snackbar(e, 'error');
                } finally {
                    dialog_loading_visible.value = false;
                }
            };

            const dialog_password_notice_visible = ref(false);
            const dialog_password_notified       = ref(false);

            const dialog_password_notice = () => {
                if(!dialog_password_notice_visible.value) {
                    dialog_password_notice_visible.value = true;

                    return;
                }

                dialog_password_notified.value       = true;
                dialog_password_notice_visible.value = false;

                dialog_password_input();
            };

            const dialog_password_input_visible = ref(false);
            const dialog_password_input_value   = ref('');
            const dialog_password_input_rules   = [
                value => !!value || '入力必須',
                value => (value && value.length >=  1) || '最小 1 文字以上必要です',
                value => (value && value.length <= 32) || '最大 32 文字以内です'
            ];
            const dialog_password_input_loading = ref(false);

            const validate = () => {
                const value = dialog_password_input_value.value;

                for(const rule of dialog_password_input_rules) {
                    const result = rule(value);

                    if(result !== true) return false;
                }

                return true;
            };

            const dialog_password_input = async () => {
                if(!dialog_password_notified.value) {
                    dialog_password_notice();

                    return;
                }

                if(!dialog_password_input_visible.value) {
                    dialog_password_input_visible.value = true;

                    return;
                }

                if(!validate()) return;

                dialog_password_input_loading.value = true;

                try {
                    let params = {
                        password: dialog_password_input_value.value,
                        command: (command.value != '' ? `app-${command.value}` : null) ?? 'app-launch'
                    };

                    const result = await api.call({ class: 'server', method: 'auth', params: params });

                    dialog_password_input_visible.value = false;

                    password.value = dialog_password_input_value.value;

                    dialog_confirm();
                } catch(e) {
                    switch(e.message) {
                        case 'api-call-result: failed - auth-failed': {
                            e = 'パスワードが存在しません';
                            break;
                        }

                        default: {
                            console.error(e);
                            break;
                        }
                    }

                    snackbar(e, 'error');
                } finally {
                    dialog_password_input_loading.value = false;
                }
            };

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            const fetchAppIDs = async () => {
                try {
                    return await api.call({ class: 'server', method: 'monitored-apps-get' });
                } catch(e) {
                    console.error(e);

                    snackbar('システムAPIとの通信に失敗しました', 'error');
                }
            };

            const fetchAppDetails = async (id = '') => {
                try {
                    return await api.call({ class: 'server', method: 'app-details-get', params: { app_id: id } });
                } catch(e) {
                    console.error(e);

                    snackbar('システムAPIとの通信に失敗しました', 'error');
                }
            };

            const fetchAppStatus = async (id = '') => {
                try {
                    return await api.call({ class: 'server', method: 'app-status-get', params: { app_id: id } });
                } catch(e) {
                    console.error(e);

                    snackbar('システムAPIとの通信に失敗しました', 'error');
                }
            };

            const apps           = ref([]);
            const fetch_executed = ref(false);

            const fetchApps = async () => {
                if(fetch_executed.value) return apps.value;

                fetch_executed.value = true;

                let appIDs = await fetchAppIDs();

                let temp = [];

                for(let id of appIDs) {
                    let details    = await fetchAppDetails(id);
                    details.status = await fetchAppStatus(id);

                    temp.push(details);
                }

                apps.value = temp;

                fetch_executed.value = false;

                return apps.value;
            };

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

            const container_visible = ref(false);

            const auto_update = ref(true);

            const interval_time = 30000;
            let   interval      = null;

            onMounted(async () => {
                document.title = APP_NAME;

                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                    theme.global.name.value = e.matches ? 'dark' : 'light';
                });

                dialog_loading('起動中...', 'mdi-lightning-bolt');

                if((await fetchApps()).length <= 0) {
                    snackbar('サーバー上にアプリがありません');

                    dialog_loading_visible.value = false;

                    return;
                }

                interval = setInterval(() => {
                    if(!auto_update.value)            return;
                    if(dialog_settings_visible.value) return;
                    if(dialog_operate_visible.value)  return;

                    fetchApps();
                }, interval_time);

                dialog_loading_visible.value = false;

                await nextTick();

                container_visible.value = true;
            });

            return {
                api,
                api_version,

                theme,
                display,

                snackbar_visible,
                snackbar_message,
                snackbar_color,
                snackbar_time,
                snackbar,

                dialog_loading_visible,
                dialog_loading_title,
                dialog_loading_icon,
                dialog_loading,
                dialog_settings_visible,
                dialog_settings,
                dialog_password_input_visible,
                dialog_password_input_value,
                dialog_password_input_rules,
                dialog_password_input_loading,
                dialog_password_input,
                dialog_password_notice_visible,
                dialog_password_notice,
                dialog_operate_visible,
                dialog_operate_select_value_1,
                dialog_operate_select_value_2,
                dialog_operate,
                dialog_confirm_visible,
                dialog_confirm,

                container_visible,

                auto_update,

                apps
            }
        },
        template: `
            <v-app style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);">
                <v-snackbar
                    style="margin-bottom: env(safe-area-inset-bottom);"
                    v-model="snackbar_visible"
                    :timeout="snackbar_time"
                    :color="snackbar_color"
                    :text="snackbar_message"
                />
                <v-dialog
                    v-model="dialog_loading_visible"
                    max-width="320"
                    persistent
                >
                    <v-list
                        class="py-2"
                        color="primary"
                        elevation="12"
                        rounded="lg"
                    >
                        <v-list-item
                            :prepend-icon="dialog_loading_icon"
                            :title="dialog_loading_title"
                        >
                            <template v-slot:prepend>
                                <div class="pe-4">
                                    <v-icon color="primary" size="x-large" />
                                </div>
                            </template>
                            <template v-slot:append>
                                <v-progress-circular
                                    indeterminate="disable-shrink"
                                    size="16"
                                    width="2"
                                />
                            </template>
                        </v-list-item>
                    </v-list>
                </v-dialog>
                <v-dialog
                    v-model="dialog_settings_visible"
                    transition="dialog-bottom-transition"
                    fullscreen
                >
                    <v-card style="padding-top: env(safe-area-inset-top);">
                        <v-toolbar>
                            <v-toolbar-title>設定</v-toolbar-title>
                            <v-toolbar-items>
                                <v-btn
                                    icon="mdi-close"
                                    @click="dialog_settings_visible = false"
                                />
                            </v-toolbar-items>
                        </v-toolbar>
                        <v-list lines="two">
                            <v-list-subheader>一般</v-list-subheader>
                            <v-list-item
                                title="データの自動更新"
                                subtitle="サーバーから定期的にデータを取得して更新します"
                                @click="auto_update = !auto_update"
                            >
                                <template #append>
                                    <v-switch
                                        v-model="auto_update"
                                        class="ml-3"
                                        color="primary"
                                        hide-details
                                        inset
                                    />
                                </template>
                            </v-list-item>
                            <v-list-item
                                title="今すぐ更新"
                                subtitle="今すぐデータを取得して更新します"
                                @click="dialog_settings('execute-update')"
                            ><template #append><v-icon icon="mdi-chevron-right" /></template></v-list-item>
                            <v-divider />
                            <v-list-subheader title="システムAPI" />
                            <v-list-item
                                title="アタッチされているAPI"
                                :subtitle="api.name"
                                href="https://github.com/kanaaa224/home-server-web-api/"
                                target="_blank"
                                rel="noopener"
                            ><template #append><v-icon icon="mdi-chevron-right" /></template></v-list-item>
                            <v-list-item
                                title="バージョン"
                                :subtitle="api_version || '取得しています...'"
                            />
                            <v-list-item
                                title="エンドポイント"
                                :subtitle="api.url"
                                :href="api.url"
                                target="_blank"
                                rel="noopener"
                            ><template #append><v-icon icon="mdi-chevron-right" /></template></v-list-item>
                            <v-divider />
                            <v-list-subheader title="アプリケーション" />
                            <v-list-item
                                title="バージョン"
                                subtitle="v1.0"
                            />
                            <v-divider />
                            <v-list-item
                                class="text-center"
                                subtitle="© 2025 kanaaa224. All rights reserved."
                                href="https://kanaaa224.github.io/"
                                target="_blank"
                                rel="noopener"
                            />
                        </v-list>
                    </v-card>
                </v-dialog>
                <v-dialog
                    v-model="dialog_password_input_visible"
                    max-width="500"
                    persistent
                >
                    <v-card
                        prepend-icon="mdi-lock"
                        title="パスワードを入力"
                        text="操作をリクエストするため、パスワードを入力してください。"
                    >
                        <v-card-text>
                            <v-text-field
                                ref="dialog_password_input_ref"
                                v-model="dialog_password_input_value"
                                label="パスワード*"
                                required
                                :rules="dialog_password_input_rules"
                                :loading="dialog_password_input_loading"
                                :disabled="dialog_password_input_loading"
                            />
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer />
                            <v-btn
                                variant="plain"
                                text="Cancel"
                                @click="dialog_password_input_visible = false"
                                :disabled="dialog_password_input_loading"
                            />
                            <v-btn
                                variant="tonal"
                                text="OK"
                                color="primary"
                                @click="dialog_password_input()"
                                :disabled="dialog_password_input_loading"
                            />
                        </v-card-actions>
                    </v-card>
                </v-dialog>
                <v-dialog
                    v-model="dialog_password_notice_visible"
                    max-width="400"
                >
                    <v-card
                        prepend-icon="mdi-lock"
                        title="パスワードが必要です"
                        text="この操作にはパスワードが必要です。次の画面でパスワードを入力してください。"
                    >
                        <v-card-actions>
                            <v-btn
                                class="ms-auto"
                                text="OK"
                                @click="dialog_password_notice()"
                            />
                        </v-card-actions>
                    </v-card>
                </v-dialog>
                <v-dialog
                    v-model="dialog_operate_visible"
                    max-width="600"
                >
                    <v-card
                        prepend-icon="mdi-lightning-bolt"
                        title="サーバーコントロール"
                        text="起動/アップデート操作はサーバーの状態が「停止中」のとき、停止操作は「実行中」のときにできます。行う操作によってはパスワードが必要です。"
                    >
                        <v-card-text>
                            <v-select
                                v-model="dialog_operate_select_value_1"
                                :items="apps.map(app => app.name)"
                                label="操作対象のアプリ*"
                                required
                            />
                            <v-select
                                v-model="dialog_operate_select_value_2"
                                :items="[ '起動', '停止', '更新' ]"
                                label="リクエストする操作*"
                                required
                            />
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer />
                            <v-btn
                                variant="plain"
                                text="Cancel"
                                @click="dialog_operate_visible = false"
                                :disabled="dialog_operate_loading"
                            />
                            <v-btn
                                variant="tonal"
                                text="Send"
                                color="primary"
                                @click="dialog_operate()"
                                :disabled="dialog_operate_loading"
                            />
                        </v-card-actions>
                    </v-card>
                </v-dialog>
                <v-dialog
                    v-model="dialog_confirm_visible"
                    max-width="400"
                >
                    <v-card
                        prepend-icon="mdi-lightning-bolt"
                        title="サーバーコントロール"
                        text="この内容でリクエストを送信しますか？"
                    >
                        <v-card-text>"{{ dialog_operate_select_value_1 }}" を {{ dialog_operate_select_value_2 }} する</v-card-text>
                        <v-card-actions>
                            <v-spacer />
                            <v-btn
                                variant="plain"
                                text="Cancel"
                                @click="dialog_confirm_visible = false"
                                :disabled="dialog_confirm_loading"
                            />
                            <v-btn
                                variant="tonal"
                                text="Send"
                                color="primary"
                                @click="dialog_confirm()"
                                :disabled="dialog_confirm_loading"
                            />
                        </v-card-actions>
                    </v-card>
                </v-dialog>
                <v-main class="d-flex">
                    <v-fade-transition mode="out-in">
                        <v-container
                            v-if="container_visible"
                            class="d-flex flex-column justify-center align-center"
                            fill-height
                        >
                            <div>
                                <h2 style="font-size: 1rem;">自宅サーバー ステータス</h2>
                                <p :style="{ fontSize: display.smAndDown.value ? '0.85rem !important' : '1rem' }">現在のサーバーの状態をリアルタイムで表示しています</p>
                            </div>
                            <div class="statuses my-7" key="statuses">
                                <div class="container">
                                    <div
                                        class="item"
                                        v-for="app in apps"
                                        :key="app.id"
                                    >
                                        <div class="container">
                                            <span class="name" :style="{ marginRight: display.smAndDown.value ? '4rem' : '7.5rem' }">{{ app.name }}</span>
                                            <span class="status">
                                                <span class="text">{{
                                                    app.status === 'running'  ? '実行中' :
                                                    app.status === 'stopped'  ? '停止中' :
                                                    app.status === 'updating' ? '更新中' : '不明'
                                                }}</span>
                                                <span
                                                    :style="{
                                                        color:      app.status === 'running'  ? '#00ff00' :
                                                                    app.status === 'stopped'  ? '#ff0000' :
                                                                    app.status === 'updating' ? '#ffa400' : 'gray',
                                                        textShadow: app.status === 'running'  ? '0 0 1rem #00ff0040' :
                                                                    app.status === 'stopped'  ? '0 0 1rem #ff000040' :
                                                                    app.status === 'updating' ? '0 0 1rem #ffa40040' : 'none'
                                                    }"
                                                >●</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex justify-center align-center" style="gap: 1rem;">
                                <v-btn :size="display.smAndDown.value ? 'small' : 'default'" color="secondary" @click="dialog_operate()">サーバーをコントロール...</v-btn>
                                <v-btn :size="display.smAndDown.value ? 'small' : 'default'" color="secondary" @click="dialog_settings()"><v-icon icon="mdi-cog" /></v-btn>
                                <v-btn
                                    :size="display.smAndDown.value ? 'small' : 'default'"
                                    color="secondary"
                                    @click="theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'"
                                ><v-icon :icon="theme.global.current.value.dark ? 'mdi-weather-night' : 'mdi-white-balance-sunny'" /></v-btn>
                            </div>
                        </v-container>
                    </v-fade-transition>
                </v-main>
                <v-footer class="justify-center pa-2" style="margin-bottom: env(safe-area-inset-bottom); opacity: 0.25; background-color: transparent;" app>
                    <span class="text-body-2">
                        © 2025 <a
                            style="color: inherit;"
                            href="https://kanaaa224.github.io/"
                            target="_blank"
                            rel="noopener"
                        >kanaaa224</a>. All rights reserved.
                    </span>
                </v-footer>
            </v-app>
        `
    });

    const vuetify = createVuetify({
        theme: {
            defaultTheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
            themes: {
                light: {
                    dark: false,
                    colors: {
                        background: '#fff',
                        surface:    '#fff',
                        primary:    '#2196f3',
                        secondary:  '#444',
                        error:      '#c23131'
                    }
                },
                dark: {
                    dark: true,
                    colors: {
                        background: '#222',
                        surface:    '#292929',
                        primary:    '#2196f3',
                        secondary:  '#eee',
                        error:      '#c23131'
                    }
                }
            }
        }
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    try {
        const params = new URLSearchParams((window.location.hash.split('?')[1] || window.location.search.substring(1) || ''));
        const url    = params.get('api_v1_custom_endpoint_url');

        if(url) {
            api.endpoint  = { name: 'WebAPI v1 (custom endpoint)', url: url };
            api.endpoints = { v1: api.endpoint };

            api.name = api.endpoint.name;
            api.url  = api.endpoint.url;
        }

        else await api.connect();
    } catch(e) {
        console.error(e);

        return alert(`APIへの接続に失敗したためアプリケーションを起動できません...\n再起動してみてください。`);
    }

    app.use(vuetify).mount('#app');
})();