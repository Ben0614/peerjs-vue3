<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Peer } from "peerjs";
import type { MediaConnection, DataConnection } from "peerjs";

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const localPeerId = ref("");
const remotePeerId = ref("");
// 發送連接
const isInCall = ref(false);
// 已連接
const isConnectionEstablished = ref(false);
// 存儲接收到的來電 (如果被接聽或拒絕就變回null)
const incomingCall = ref<MediaConnection | null>(null);
// 啟用視訊音訊
const isAudioEnabled = ref(true);
const isVideoEnabled = ref(true);
// 建立和管理點對點的數據連接
const dataConnection = ref<DataConnection | null>(null);

//  PeerJS 實例 創建和管理所有連接
const peer = ref<Peer | null>(null);
// 當前活躍的通話連接
const call = ref<MediaConnection | null>(null);
const localStream = ref<MediaStream | null>(null);
const connectionTimeout = ref<number | null>(null);

// 開始通話
const startCall = async () => {
  if (peer.value) {
    const constraints = { video: true, audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    localStream.value = stream;

    if (localVideo.value) {
      localVideo.value.srcObject = stream;
    }
    if (peer.value) {
      call.value = peer.value.call(remotePeerId.value, stream);
    }

    setupCallEventHandlers();

    // 建立數據連接
    dataConnection.value = peer.value.connect(remotePeerId.value);
    setupDataConnectionHandlers();

    // 設置超時檢查
    // 目前設置30秒 可修改
    connectionTimeout.value = window.setTimeout(() => {
      if (!isConnectionEstablished.value) {
        endCall();
        console.log("無法建立連接，自動結束通話");
      }
    }, 30000);

    isInCall.value = true;
  }
};

// 接聽來電
const answerCall = async () => {
  if (incomingCall.value) {
    const constraints = { video: true, audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream.value = stream;
    if (localVideo.value) {
      localVideo.value.srcObject = stream;
    }

    incomingCall.value.answer(stream);
    call.value = incomingCall.value;
    setupCallEventHandlers();
    isInCall.value = true;
    incomingCall.value = null;
  }
};

// 拒絕來電
const rejectCall = () => {
  if (incomingCall.value && dataConnection.value) {
    dataConnection.value.send("call-rejected");
  }
  cleanupCall();
};

// 設置通話事件處理器
const setupCallEventHandlers = () => {
  if (call.value) {
    call.value.on("stream", (remoteStream) => {
      if (remoteVideo.value) {
        remoteVideo.value.srcObject = remoteStream;
      }
      isConnectionEstablished.value = true;
      if (connectionTimeout.value !== null) {
        clearTimeout(connectionTimeout.value);
        connectionTimeout.value = null;
      }
    });

    call.value.on("close", () => {
      endCall();
    });
  }
};

// 結束通話
const endCall = () => {
  if (dataConnection.value) {
    dataConnection.value.send("call-ended");
  }
  cleanupCall();
};

// 清理通話相關資源
const cleanupCall = () => {
  if (call.value) {
    call.value.close();
  }
  if (dataConnection.value) {
    dataConnection.value.close();
  }
  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop());
  }
  if (localVideo.value) localVideo.value.srcObject = null;
  if (remoteVideo.value) remoteVideo.value.srcObject = null;

  isInCall.value = false;
  isConnectionEstablished.value = false;
  incomingCall.value = null;
  call.value = null;
  dataConnection.value = null;
  localStream.value = null;

  if (connectionTimeout.value !== null) {
    clearTimeout(connectionTimeout.value);
    connectionTimeout.value = null;
  }
};

// 控制音訊
const toggleAudio = () => {
  if (localStream.value) {
    const audioTrack = localStream.value.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    isAudioEnabled.value = audioTrack.enabled;
  }
};

// 控制視訊
const toggleVideo = () => {
  if (localStream.value) {
    const videoTrack = localStream.value.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    isVideoEnabled.value = videoTrack.enabled;
  }
};

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
// 初始化 Peer
const initializePeer = () => {
  peer.value = new Peer({
    config: configuration,
  });

  peer.value.on("open", (id) => {
    localPeerId.value = id;
  });

  peer.value.on("call", (incomingCallData: MediaConnection) => {
    incomingCall.value = incomingCallData;
    // 顯示接聽或拒絕的選項給用戶
  });

  peer.value.on("connection", (conn: DataConnection) => {
    dataConnection.value = conn;
    setupDataConnectionHandlers();
  });
};

// 設置數據連接的處理器
const setupDataConnectionHandlers = () => {
  if (dataConnection.value) {
    dataConnection.value.on("data", (data) => {
      if (data === "call-rejected") {
        console.log("通話被拒絕");
        endCall();
      } else if (data === "call-ended") {
        console.log("對方結束了通話");
        cleanupCall();
      }
    });
  }
};

onMounted(() => {
  initializePeer();
});

onUnmounted(() => {
  if (peer.value) {
    peer.value.destroy();
  }
  cleanupCall();
});
</script>

<template>
  <div class="page-wrap">
    <p class="desc">請在底下輸入對方的Peer ID建立通話</p>
    <div class="room">
      <p v-if="localPeerId">{{ localPeerId }}</p>
      <p v-else>ID產生中...</p>
    </div>
    <div class="room">
      <h3 v-if="!isInCall && !isConnectionEstablished">未連接</h3>
      <h3 v-if="isInCall && !isConnectionEstablished">連接中</h3>
      <h3 v-if="isInCall && isConnectionEstablished">已連接</h3>
    </div>
    <div class="room">
      <p>建立通話</p>
      <input
        v-model="remotePeerId"
        placeholder="輸入對方的ID"
        :disabled="isInCall"
      />
      <br />
      <button class="big-btn-style" @click="startCall" :disabled="isInCall">
        建立
      </button>
    </div>
    <!-- 當有來電時顯示 -->
    <div v-if="incomingCall">
      <button class="big-btn-style" @click="answerCall">接聽</button>
      <button class="big-btn-style" @click="rejectCall">拒絕</button>
    </div>

    <div>
      <div>
        <button
          class="small-btn-style"
          @click="toggleAudio"
          :disabled="!isConnectionEstablished"
        >
          <span v-if="!isAudioEnabled">開音訊</span>
          <span v-else>關音訊</span>
        </button>
        <button
          class="small-btn-style"
          @click="toggleVideo"
          :disabled="!isConnectionEstablished"
        >
          <span v-if="!isVideoEnabled">開視訊</span>
          <span v-else>關視訊</span>
        </button>
        <button
          class="small-btn-style"
          @click="endCall"
          :disabled="!isConnectionEstablished"
        >
          <span>結束通話</span>
        </button>
      </div>
      <div class="video-wrap">
        <div class="video">
          <h3>自己</h3>
          <!-- local 需要 muted -->
          <video class="w100" ref="localVideo" autoPlay muted playsInline />
        </div>
        <div class="video">
          <h3>對方</h3>
          <video class="w100" ref="remoteVideo" autoPlay playsInline />
        </div>
      </div>
    </div>
  </div>
</template>
<style>
p,
button {
  margin: 10px 0;
}
.page-wrap {
  width: 1000px;
  max-width: 100%;
}
.desc {
  width: 500px;
  text-align: left;
  margin: 10px auto;
}
.big-btn-style,
.small-btn-style {
  border: 1px solid #000;
  margin: 10px 5px;
}
.small-btn-style {
  padding: 5px;
}

input {
  height: 30px;
  padding: 0 10px;
}

.room {
  width: 500px;
  border: 2px solid #000;
  padding: 10px;
  margin: 10px auto;
}
.video-wrap {
  display: flex;
  justify-content: space-between;
}
.video {
  width: 48%;
  border: 2px solid #000;
  padding: 5px;
}

.mb-10 {
  margin-bottom: 10px;
}
.w100 {
  width: 100%;
}
</style>
