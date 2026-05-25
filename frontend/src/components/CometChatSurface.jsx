/**
 * CometChat surface — server-side user provisioning + UID login.
 *
 * Flow:
 *   1. Init CometChat UI Kit (once).
 *   2. Fetch /api/woodchat/comet/config — backend creates the CometChat
 *      user (idempotent) using the App's Auth Key as the REST apikey,
 *      and returns the safe uid + config.
 *   3. CometChatUIKit.login(uid) using the Auth Key already initialized.
 */
import { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, AlertCircle } from "lucide-react";
import { BACKEND_URL } from "../lib/config";

const WC_TOKEN_KEY = "wc_token";

let initPromise = null;
let SDKModule = null;
let activeLogin = null; // { uid, promise } — serializes parallel login calls

const ensureInit = async ({ appId, region, authKey, hasAuthToken }) => {
  if (!appId) {
    throw new Error("CometChat App ID missing.");
  }
  if (!authKey && !hasAuthToken) {
    throw new Error("CometChat credentials missing on the server response.");
  }
  if (!SDKModule) {
    SDKModule = await import("@cometchat/chat-uikit-react");
  }
  const { CometChatUIKit, UIKitSettingsBuilder } = SDKModule;
  if (!initPromise) {
    const builder = new UIKitSettingsBuilder()
      .setAppId(appId)
      .setRegion(region)
      .subscribePresenceForAllUsers();
    if (authKey) builder.setAuthKey(authKey);
    initPromise = CometChatUIKit.init(builder.build());
  }
  await initPromise;
  return SDKModule;
};

const loginOnce = async (CometChatUIKit, uid, authToken) => {
  if (activeLogin && activeLogin.uid === uid) {
    return activeLogin.promise;
  }
  if (activeLogin && activeLogin.uid !== uid) {
    try { await activeLogin.promise; } catch { /* ignore */ }
    try { await CometChatUIKit.logout(); } catch { /* ignore */ }
  }
  let logged = null;
  try { logged = await CometChatUIKit.getLoggedinUser(); } catch { logged = null; }
  if (logged && logged.getUid?.() === uid) {
    return logged;
  }
  if (logged) {
    try { await CometChatUIKit.logout(); } catch { /* ignore */ }
  }
  const p = (authToken
    ? CometChatUIKit.loginWithAuthToken(authToken)
    : CometChatUIKit.login(uid)
  ).finally(() => {
    if (activeLogin && activeLogin.uid === uid && activeLogin.promise === p) {
      activeLogin = null;
    }
  });
  activeLogin = { uid, promise: p };
  return p;
};

const CometChatSurface = ({ view = "chats" }) => {
  const [status, setStatus] = useState({ loading: true, error: null });
  const [mod, setMod] = useState(null);
  const [active, setActive] = useState({ kind: null, value: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Fetch CometChat config + provision user server-side.
        const t = localStorage.getItem(WC_TOKEN_KEY);
        const base = `${BACKEND_URL}/api/woodchat`;
        const { data: cfg } = await axios.get(`${base}/comet/config`, {
          headers: t ? { Authorization: `Bearer ${t}` } : {},
        });
        const { uid, app_id, region, auth_key, auth_token } = cfg;

        // 2) Init UI Kit (auth_key only used in dev fallback).
        const m = await ensureInit({
          appId: app_id,
          region,
          authKey: auth_key || "",
          hasAuthToken: !!auth_token,
        });
        const { CometChatUIKit } = m;

        // 3) Login (serialized) — prefer auth_token (production) over uid (dev).
        await loginOnce(CometChatUIKit, uid, auth_token);

        if (!cancelled) {
          setMod(m);
          setStatus({ loading: false, error: null });
        }
      } catch (err) {
        // Surface a useful error to the user.
        const code = err?.code || err?.details?.code || "";
        const detail = err?.response?.data?.detail;
        const msg =
          detail ||
          err?.message ||
          "Couldn't connect to chat. Try refreshing in a moment.";
        if (!cancelled) {
          setStatus({ loading: false, error: `${msg}${code ? ` (${code})` : ""}` });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.loading) {
    return (
      <div className="wx-empty">
        <Loader2 size={20} className="animate-spin" />
        <div>Connecting securely to WoodX network…</div>
      </div>
    );
  }
  if (status.error) {
    return (
      <div className="wx-empty">
        <div
          className="wx-empty-icon"
          style={{ background: "rgba(220,80,80,0.12)", color: "#dc4d4d" }}
        >
          <AlertCircle size={22} />
        </div>
        <div className="wx-empty-title">Chat is offline</div>
        <div style={{ maxWidth: 460, lineHeight: 1.55 }}>{status.error}</div>
      </div>
    );
  }

  const {
    CometChatConversations,
    CometChatUsers,
    CometChatGroups,
    CometChatMessageHeader,
    CometChatMessageList,
    CometChatMessageComposer,
  } = mod || {};

  // ChatLayout: list pane (left) + active chat pane (right)
  const ListPane =
    view === "groups" ? CometChatGroups :
    view === "contacts" ? CometChatUsers :
    CometChatConversations;

  if (!ListPane || !CometChatMessageList) {
    return (
      <div className="wx-empty">
        <div className="wx-empty-title">Chat view unavailable</div>
      </div>
    );
  }

  const handleSelect = (item) => {
    // CometChatConversations passes a Conversation; Users/Groups pass User/Group directly.
    if (!item) return;
    if (typeof item.getConversationWith === "function") {
      const target = item.getConversationWith();
      const kind = item.getConversationType?.();
      if (kind === "group") setActive({ kind: "group", value: target });
      else setActive({ kind: "user", value: target });
      return;
    }
    if (view === "groups") setActive({ kind: "group", value: item });
    else setActive({ kind: "user", value: item });
  };

  const headerProps = active.kind === "group" ? { group: active.value } : active.kind === "user" ? { user: active.value } : {};

  return (
    <div className="wx-cc-host cometchat" data-testid={`wx-cc-${view}`}>
      <div className="wx-chat-shell">
        <div className="wx-conv-pane">
          <ListPane
            onItemClick={handleSelect}
            onConversationClick={handleSelect}
            onUserClick={handleSelect}
            onGroupClick={handleSelect}
          />
        </div>
        <div className="wx-chat-pane">
          {active.kind ? (
            <>
              <CometChatMessageHeader {...headerProps} />
              <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                <CometChatMessageList {...headerProps} />
              </div>
              <CometChatMessageComposer {...headerProps} />
            </>
          ) : (
            <div className="wx-empty">
              <div className="wx-empty-icon" style={{ width: 40, height: 40 }} />
              <div style={{ fontSize: 13.5 }}>
                {view === "groups"
                  ? "Pick a group to open the conversation."
                  : view === "contacts"
                    ? "Pick a contact to start a conversation."
                    : "Pick a conversation to start messaging."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CometChatSurface;
