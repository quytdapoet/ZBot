import { getOwnId } from "./apis/getOwnId.js";
import { Listener } from "./apis/listen.js";
import { getServerInfo, login } from "./apis/login.js";
import { appContext } from "./context.js";
import { logger, makeURL } from "./utils.js";
import { addReactionFactory } from "./apis/addReaction.js";
import { addUserToGroupFactory } from "./apis/addUserToGroup.js";
import { changeGroupAvatarFactory } from "./apis/changeGroupAvatar.js";
import { changeGroupNameFactory } from "./apis/changeGroupName.js";
import { createGroupFactory } from "./apis/createGroup.js";
import { findUserFactory } from "./apis/findUser.js";
import { getGroupInfoFactory } from "./apis/getGroupInfo.js";
import { getStickersFactory } from "./apis/getStickers.js";
import { getStickersDetailFactory } from "./apis/getStickersDetail.js";
import { removeUserFromGroupFactory } from "./apis/removeUserFromGroup.js";
import { sendStickerFactory } from "./apis/sendSticker.js";
import { undoFactory } from "./apis/undo.js";
import { uploadAttachmentFactory } from "./apis/uploadAttachment.js";
import { checkUpdate } from "./update.js";
import { sendMessageFactory } from "./apis/sendMessage.js";
import { getCookieFactory } from "./apis/getCookie.js";
import { removeMessageFactory } from "./apis/deleteMessage.js";

export class Zalo {
    constructor(credentials, options) {
        this.enableEncryptParam = true;
        this.validateParams(credentials);
        appContext.imei = credentials.imei;
        appContext.cookie = this.parseCookies(credentials.cookie);
        appContext.userAgent = credentials.userAgent;
        appContext.language = credentials.language || "vi";
        appContext.secretKey = null;
        if (options)
            Object.assign(appContext.options, options);
    }

    parseCookies(cookie) {
        if (typeof cookie === "string")
            return cookie;
        const cookieString = cookie.cookies.map(c => `${c.name}=${c.value}`).join("; ");
        return cookieString;
    }

    validateParams(credentials) {
        if (!credentials.imei || !credentials.cookie || !credentials.userAgent) {
            throw new Error("Thiếu dữ liệu đầu vào");
        }
    }

    async login() {
        await checkUpdate();
        const loginData = await login(this.enableEncryptParam);
        const serverInfo = await getServerInfo(this.enableEncryptParam);
        if (!loginData || !serverInfo)
            throw new Error("Đăng nhập thất bại");

        appContext.secretKey = loginData.data.zpw_enk;
        appContext.uid = loginData.data.uid;
        // Zalo currently responds with setttings instead of settings
        // they might fix this in the future, so we should have a fallback just in case
        appContext.settings = serverInfo.setttings || serverInfo.settings;
        logger.info("Đã đăng nhập với ID:", loginData.data.uid);

        // Initialize API with version and type
        return new API(appContext.secretKey, loginData.data.zpw_service_map_v3, makeURL(`${loginData.data.zpw_ws[0]}`, {
            zpw_ver: Zalo.API_VERSION,
            zpw_type: Zalo.API_TYPE,
            t: Date.now(),
        }));
    }
}

Zalo.API_TYPE = 30;
Zalo.API_VERSION = 637;

export class API {
    constructor(secretKey, zpwServiceMap, wsUrl) {
        this.secretKey = secretKey;
        this.zpwServiceMap = zpwServiceMap;
        this.API_VERSION = Zalo.API_VERSION; // Added API_VERSION
        this.API_TYPE = Zalo.API_TYPE; // Added API_TYPE
        this.listener = new Listener(wsUrl);
        this.addReaction = addReactionFactory(makeURL(`${zpwServiceMap.reaction[0]}/api/message/reaction`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.getOwnId = getOwnId;
        this.getStickers = getStickersFactory(makeURL(`${zpwServiceMap.sticker}/api/message/sticker`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.getStickersDetail = getStickersDetailFactory(makeURL(`${zpwServiceMap.sticker}/api/message/sticker`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.sendSticker = sendStickerFactory(this);
        this.findUser = findUserFactory(makeURL(`${zpwServiceMap.friend[0]}/api/friend/profile/get`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.uploadAttachment = uploadAttachmentFactory(`${zpwServiceMap.file[0]}/api`, this);
        this.undo = undoFactory(this);
        this.getGroupInfo = getGroupInfoFactory(makeURL(`${zpwServiceMap.group[0]}/api/group/getmg-v2`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.createGroup = createGroupFactory(makeURL(`${zpwServiceMap.group[0]}/api/group/create/v2`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }), this);
        this.changeGroupAvatar = changeGroupAvatarFactory(makeURL(`${zpwServiceMap.file[0]}/api/group/upavatar`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.removeUserFromGroup = removeUserFromGroupFactory(makeURL(`${zpwServiceMap.group[0]}/api/group/kickout`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.addUserToGroup = addUserToGroupFactory(makeURL(`${zpwServiceMap.group[0]}/api/group/invite/v2`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.changeGroupName = changeGroupNameFactory(makeURL(`${zpwServiceMap.group[0]}/api/group/updateinfo`, {
            zpw_ver: this.API_VERSION,
            zpw_type: this.API_TYPE,
        }));
        this.sendMessage = sendMessageFactory(this);
        this.getCookie = getCookieFactory();
        this.deleteMessage = removeMessageFactory(this);
    }
}
