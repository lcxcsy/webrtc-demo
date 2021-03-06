/*
 * @Author: l刘晨曦
 * @Date: 2021-09-28 09:34:32
 * @LastEditTime: 2021-09-28 09:44:22
 * @LastEditors: Please set LastEditors
 * @Description: In User Settings Edit
 * @FilePath: \webrtc-demo\public\static\js\index.js
 */
/** ******* 判断用户类型 **********/
const target = location.search.slice(6)
document.title = target === 'offer' ? 'Caller' : 'Answer'

/** ******* 日志消息 **********/
const message = {
  el: document.querySelector('.logger'),
  log (msg) {
    this.el.innerHTML += `<span>${new Date().toLocaleTimeString()}：${msg}</span><br/>`
  },
  error (msg) {
    this.el.innerHTML += `<span class="error">${new Date().toLocaleTimeString()}：${msg}</span><br/>`
  }
}

/** ******* 信息通道消息类型 **********/
const WS_EVENT_TYPES = {
  CALL: 'call',
  ACCEPT: 'accept',
  REFUSE: 'refuse',
  OFFER: 'offer',
  OFFER_ICE: 'offer_ice',
  ANSWER: 'answer',
  ANSWER_ICE: 'answer_ice'
}

const button = document.querySelector('.start-button')
const acceptButton = document.querySelector('.accept-button')
const refuseButton = document.querySelector('.refuse-button')

/** ******* 信令通道 **********/
message.log('信令通道（WebSocket）创建中......')
const signalingChannel = new WebSocket('ws://localhost:3000/webrtc')

signalingChannel.onopen = () => {
  message.log('信令通道创建成功！')
  target === 'offer' && (button.style.display = 'block')
}

signalingChannel.onerror = () => message.error('信令通道创建失败！')
signalingChannel.onmessage = async e => {
  const { type, sdp, iceCandidate } = JSON.parse(e.data)
  switch (type) {
    case WS_EVENT_TYPES.CALL:
      message.log('收到远程呼叫')
      acceptButton.style.display = 'inline'
      refuseButton.style.display = 'inline'
      break

    case WS_EVENT_TYPES.ACCEPT:
      message.log('对方已接受通话邀请')
      button.style.display = 'none'
      createOffer()
      break

    case WS_EVENT_TYPES.REFUSE:
      message.log('对方已拒绝通话邀请')
      button.innerHTML = '重新呼叫'
      alert('对方已拒绝')
      // eslint-disable-next-line
      const localVideo = document.getElementById('local-video')
      localVideo && localVideo.remove()
      break

    case WS_EVENT_TYPES.ANSWER:
      peer.setRemoteDescription(new RTCSessionDescription({ type, sdp }))
      break

    case WS_EVENT_TYPES.ANSWER_ICE:
      peer.addIceCandidate(new RTCIceCandidate(iceCandidate))
      break

    case WS_EVENT_TYPES.OFFER:
      await getUserMedia()
      createAnswer(new RTCSessionDescription({ type, sdp }))
      break

    case WS_EVENT_TYPES.OFFER_ICE:
      peer.addIceCandidate(new RTCIceCandidate(iceCandidate))
      break
  }
}

/** ******* RTCPeerConnection **********/
const PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection
!PeerConnection && message.error('浏览器不支持WebRTC！')

const peer = new PeerConnection()

peer.ontrack = e => {
  if (e && e.streams) {
    message.log('收到对方音频/视频流数据...')
    if (!document.querySelector('#remote-video')) {
      createVideo({ id: 'remote-video', stream: e.streams[0] })
    }
  }
}

// 收集候选者触发的事件
peer.onicecandidate = e => {
  if (e.candidate) {
    message.log('搜集并发送候选人')
    signalingChannel.send(JSON.stringify({
      type: `${target}_ice`,
      iceCandidate: e.candidate
    }))
  } else {
    message.log('候选人收集完成！')
  }
}

// 获取媒体信息
async function getUserMedia () {
  let stream
  try {
    message.log('尝试调取本地摄像头/麦克风')
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    message.log('摄像头/麦克风获取成功！')
    createVideo({ id: 'local-video', stream })

    message.log(`------ WebRTC ${target === 'offer' ? '发起方' : '接收方'}流程开始 ------`)
    message.log('将媒体轨道添加到轨道集')
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream)
    })
  } catch {
    message.error('摄像头/麦克风获取失败！')
    return
  }
}

// 创建video标签
function createVideo (e) {
  const video = document.createElement('video')
  document.getElementById('video-box').appendChild(video)
  video.id = e.id
  video.srcObject = e.stream
  video.autoplay = true
}

// 提供Offer
async function createOffer () {
  message.log('创建本地SDP')
  const offer = await peer.createOffer()
  peer.setLocalDescription(offer)

  message.log(`传输发起方本地SDP`)
  signalingChannel.send(JSON.stringify(offer))
}

// 提供应答
async function createAnswer (offerSdp) {
  message.log('接收到发送方SDP')
  await peer.setRemoteDescription(offerSdp)

  message.log('创建接收方（应答）SDP')
  const answer = await peer.createAnswer()

  message.log(`传输接收方（应答）SDP`)
  peer.setLocalDescription(answer)
  signalingChannel.send(JSON.stringify(answer))
}
