const { createApp, ref, onMounted } = Vue;
const { createVuetify, useTheme } = Vuetify;

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
                    surface:    '#222',
                    primary:    '#2196f3',
                    secondary:  '#eee',
                    error:      '#c23131'
                }
            }
        }
    }
});

const app = createApp({
    setup() {
        const theme = useTheme();

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        const logging = (d = '') => {
            console.log(`[ ${(new Date()).toISOString()} ] ${d}`);
        };

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

        const API_URI = ref('');

        const callAPI = async (requestBody = {}, queries = '', uri = API_URI.value) => {
            if(queries) uri += /\?/.test(uri) ? `&${queries}` : `?${queries}`;

            const response = await fetch(uri, { method: 'POST', body: JSON.stringify(requestBody) });
            const data     = await response.json();

            if(!data.status) throw `api-bad-status`;

            if(data.data.result != 'success') throw `api-call-result: failed - ${data.data.value}`;

            return data.data.value;
        };

        const API_ENDPOINTS = ref(null);
        const API_VERSION   = ref('');
        const API_NAME      = ref('');

        const connectAPI = async (url = '') => {
            try {
                const response = await fetch(url);
                const data     = await response.json();

                API_ENDPOINTS.value = data;
                API_URI.value       = `https://${data.web_api.v1.uri}`;

                logging(`API | connected`);

                const version = await callAPI({ method: 'version' });

                logging(`API | version: ${version}`);

                API_VERSION.value = version;
                API_NAME.value    = 'WebAPI v1';
            } catch(e) {
                console.error(e);

                snackbar('APIへの接続に失敗しました', 'error');
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

                return;
            }

            switch(cmd) {
                case 'execute-update': {
                    dialog_loading('更新中...', 'mdi-lightning-bolt');

                    if((await fetchApps()).length <= 0) snackbar('サーバー上にアプリがありません');

                    dialog_loading_visible.value = false;

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

                await callAPI({ class: 'server', method: 'app-operate', params: params });

                snackbar('成功しました', 'success');

                dialog_operate_visible.value = false;

                await fetchApps();
            } catch(e) {
                snackbar('失敗しました', 'error');
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

                const result = await callAPI({ class: 'server', method: 'auth', params: params });

                dialog_password_input_visible.value = false;

                password.value = dialog_password_input_value.value;

                dialog_confirm();
            } catch(e) {
                switch(e) {
                    case 'api-call-result: failed - auth-failed': {
                        e = 'パスワードが存在しません';
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
                return await callAPI({ class: 'server', method: 'monitored-apps-get' });
            } catch(e) {
                snackbar(e, 'error');
            }
        };

        const fetchAppDetails = async (id = '') => {
            try {
                return await callAPI({ class: 'server', method: 'app-details-get', params: { app_id: id } });
            } catch(e) {
                snackbar(e, 'error');
            }
        };

        const fetchAppStatus = async (id = '') => {
            try {
                return await callAPI({ class: 'server', method: 'app-status-get', params: { app_id: id } });
            } catch(e) {
                snackbar(e, 'error');
            }
        };

        const apps           = ref([]);
        const fetch_executed = ref(false);

        const fetchApps = async () => {
            if(dialog_settings_visible.value) return;
            if(dialog_operate_visible.value)  return;

            if(fetch_executed.value) return;

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

        const statuses_visible = ref(false);
        const button_visible   = ref(false);

        const interval_time = ref(30000);
        const interval      = ref(null);

        const initialize = async () => {
            logging(`initialized`);

            dialog_loading('起動中...', 'mdi-lightning-bolt');

            if((await fetchApps()).length <= 0) {
                snackbar('サーバー上にアプリがありません');

                dialog_loading_visible.value = false;

                return;
            }

            interval.value = setInterval(fetchApps, interval_time.value);

            dialog_loading_visible.value = false;

            statuses_visible.value = true;
            button_visible.value   = true;
        };

        onMounted(() => {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                theme.global.name.value = e.matches ? 'dark' : 'light';
            });

            window.addEventListener('load', async () => {
                await connectAPI(API_ENDPOINTS_URL);
                await initialize();
            });
        });

        const APP_VERSION = 'v1.0';

        return {
            theme,

            API_URI,
            API_ENDPOINTS,
            API_VERSION,
            API_NAME,

            APP_VERSION,

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

            password,
            command,
            app_id,

            apps,
            fetchApps,

            statuses_visible,
            button_visible,
        };
    }
});

app.use(vuetify).mount('#app');