<script setup lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from "vue";
import Peer from "peerjs";
import type { DataConnection } from "peerjs";

interface Message {
  peerId: string;
  sender: string;
  content: string;
}

const peer = ref<Peer | null>(null);
const username = ref("");
const localPeerId = ref("");
const remotePeerId = ref("");
const peerUsername = ref("");
const connecting = ref(false);
const connected = ref(false);
const connection = ref<DataConnection | null>(null);
const connectionAlertTimeout = ref<number | null>(null);
const messages = ref<Message[]>([]);
const newMessage = ref("");
// 30秒
const timeoutMs = ref(30000);

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

const initializePeer = () => {
  if (!username.value) {
    window.alert("請輸入暱稱");
    return;
  }
  peer.value = new Peer({
    config: configuration,
  });

  peer.value.on("open", (id) => {
    localPeerId.value = id;
  });

  peer.value.on("connection", handleIncomingConnection);

  peer.value.on("error", (error) => {
    console.error("error:", error);
    window.alert(`發生錯誤: ${error.type}`);
  });
};

const handleIncomingConnection = (conn: DataConnection) => {
  const accept = window.confirm(
    `用戶 "${conn.metadata.username}" 想要和您聊天，您同意嗎?`
  );

  // 設置一個 3 秒的超時警告
  connectionAlertTimeout.value = window.setTimeout(() => {
    window.alert("連接請求已超時。");
  }, timeoutMs.value);

  if (accept) {
    conn.on("open", () => {
      if (connectionAlertTimeout.value) {
        clearTimeout(connectionAlertTimeout.value);
      }
      setupConnection(conn);
    });
    peerUsername.value = conn.metadata.username;
  } else {
    conn.on("open", () => {
      conn.send({ type: "REJECTED" });
      conn.close();
      if (connectionAlertTimeout.value) {
        clearTimeout(connectionAlertTimeout.value);
      }
    });
  }
};

const connectToPeer = () => {
  if (!peer.value || !remotePeerId.value) return;
  connecting.value = true;
  const conn = peer.value.connect(remotePeerId.value, {
    metadata: { username: username.value },
  });

  const connectionTimeout = window.setTimeout(() => {
    if (!connected.value) {
      conn.close();
      connecting.value = false;
      window.alert("連接超時。請稍後再試。");
      // 發送超時消息給被邀請者
      conn.send({ type: "CONNECTION_TIMEOUT" });
    }
  }, timeoutMs.value);

  // 等待連接打開後再設置
  conn.on("open", () => {
    clearTimeout(connectionTimeout);
    setupConnection(conn);
  });

  conn.on("error", (err) => {
    clearTimeout(connectionTimeout);
    connecting.value = false;
    console.error("Connection error:", err);
    window.alert(`連接錯誤: ${err}`);
  });

  conn.on("data", (data: any) => {
    if (typeof data === "object" && data.type === "REJECTED") {
      clearTimeout(connectionTimeout);
      connecting.value = false;
      window.alert("對方拒絕了您的連接請求。");
      conn.close();
    }
  });
};

const setupConnection = (conn: DataConnection) => {
  connection.value = conn;
  connected.value = true;
  connecting.value = false;
  console.log("Connected to peer");

  conn.send({ type: "USERNAME", username: username.value });

  conn.on("data", (data: any) => {
    if (typeof data === "object") {
      if (data.type === "USERNAME") {
        peerUsername.value = data.username;
      } else if (data.type === "CONNECTION_TIMEOUT") {
        if (connectionAlertTimeout.value) {
          clearTimeout(connectionAlertTimeout.value);
        }
        window.alert("對方連接已超時。");
      }
    } else if (typeof data === "string") {
      messages.value.push({
        peerId: remotePeerId.value,
        sender: peerUsername.value,
        content: data,
      });
    }
  });

  conn.on("close", () => {
    connected.value = false;
    if (connectionAlertTimeout.value) {
      clearTimeout(connectionAlertTimeout.value);
    }
    window.alert("連線結束");
  });
};

const sendMessage = () => {
  if (!connection.value || !newMessage.value) return;
  connection.value.send(newMessage.value);
  messages.value.push({
    peerId: localPeerId.value,
    sender: username.value,
    content: newMessage.value,
  });
  newMessage.value = "";
};

onUnmounted(() => {
  if (peer.value) {
    peer.value.destroy();
  }
  if (connectionAlertTimeout.value) {
    clearTimeout(connectionAlertTimeout.value);
  }
});
</script>

<template>
  <h3>網址請勿使用localhost，使用IP。</h3>
  <div class="status-style">
    <h3 v-if="!connecting && !connected">未連接</h3>
    <h3 v-if="connecting && !connected">連接中</h3>
    <h3 v-if="connected">已連接</h3>
  </div>
  <div class="chat-app">
    <div v-if="!peer">
      <h2>請輸入您的暱稱</h2>
      <input
        v-model="username"
        placeholder="暱稱"
        @keyup.enter="initializePeer"
      />
      <br />
      <button @click="initializePeer" class="big-btn-style">進入</button>
    </div>
    <div v-else-if="!connected">
      <h3 v-if="!localPeerId">產生中...</h3>
      <h3 v-else>您的ID: {{ localPeerId }}</h3>
      <h3>請在底下輸入對方的Peer ID建立連接</h3>
      <input
        v-model="remotePeerId"
        placeholder="輸入對方的ID"
        @keyup.enter="connectToPeer"
      />
      <br />
      <button
        @click="connectToPeer"
        class="big-btn-style"
        :disabled="connecting"
      >
        建立
      </button>
    </div>
    <div v-else>
      <h2 class="my-5">聊天室</h2>
      <h3 class="my-5">對方:{{ peerUsername }}</h3>
      <div class="messages">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :style="{
            display: 'flex',
            justifyContent: msg.peerId === localPeerId ? 'end' : 'start',
            alignItems: 'center',
          }"
        >
          <strong v-if="msg.peerId !== localPeerId">{{ msg.sender }}:</strong>
          <div
            :style="{
              background:
                msg.peerId !== localPeerId
                  ? 'rgba(255, 192, 203,.5)'
                  : 'rgba(135, 206, 235,.3)',
            }"
            class="message"
          >
            {{ msg.content }}
          </div>
        </div>
      </div>
      <input
        v-model="newMessage"
        @keyup.enter="sendMessage"
        placeholder="輸入訊息..."
      />
      <button @click="sendMessage" class="big-btn-style">發送</button>
    </div>
  </div>
</template>

<style scoped>
.chat-app {
  width: 500px;
  margin: 0 auto;
  padding: 20px;
  border: 2px solid #000;
}

.messages {
  height: 300px;
  overflow-y: auto;
  border: 1px solid #ccc;
  padding: 10px;
  margin-bottom: 10px;
}

.message {
  width: fit-content;
  border-radius: 15px;
  margin: 5px 0 5px 5px;
  padding: 5px 10px;
}

input {
  height: 30px;
  padding: 0 10px;
}

.big-btn-style {
  border: 1px solid #000;
  margin: 10px 5px;
}

.my-5 {
  margin: 5px 0;
}

.status-style {
  border: 2px solid #000;
  margin-bottom: 10px;
}
</style>
