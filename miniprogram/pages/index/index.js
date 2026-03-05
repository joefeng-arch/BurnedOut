const app = getApp();

Page({
  data: {
    url: ""
  },
  onLoad() {
    this.setData({
      url: app.globalData.webUrl
    });
  },
  onShareAppMessage() {
    return {
      title: "废了么？来测测你的废度",
      path: "/pages/index/index",
      imageUrl: "" // 可以后续添加分享图片
    };
  },
  onShareTimeline() {
    return {
      title: "废了么？来测测你的废度"
    };
  }
});
