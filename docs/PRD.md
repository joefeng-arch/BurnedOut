# Vibe-PRD: 废了么 / Burned Out?
**Version:** 1.0 (February 2026) | [cite_start]**Target:** China, UK, Nordic [cite: 4, 5]

---

## 1. 产品定位 (Elevator Pitch)
[cite_start]「废了么」是一个为中英两国高压环境下年轻人设计的极简情绪出口工具 [cite: 7][cite_start]。用户通过打卡“废”程度、在发泄桶匿名倾诉、查看全球共鸣数据来获得心理慰藉 [cite: 7]。
* [cite_start]**中文名:** 废了么 [cite: 8]
* [cite_start]**英文名:** Burned Out? [cite: 8]
* [cite_start]**参考模型:** “死了么” App (极简功能 + 病毒式传播) [cite: 9]

---

## 2. MVP 核心功能 (Must-Haves)

### [cite_start]Feature 1: “废”度打卡 (Burnout Check-in) [cite: 11]
* [cite_start]**逻辑:** 每日一次，5级量表打卡 [cite: 12, 16]。
* [cite_start]**级别:** 1.还行(Surviving) / 2.有点废(Meh) / 3.很废(Burned) / 4.彻底废了(Fried) / 5.已灭(Gone) [cite: 13, 14]。

### [cite_start]Feature 2: 发泄桶 (Vent Bin) [cite: 17]
* [cite_start]**交互:** 文本输入 -> 点击“销毁” -> 播放碎裂/燃烧/黑洞动画 [cite: 19, 20]。
* [cite_start]**隐私:** 内容不储存、不上传、不可查看 [cite: 21]。
* [cite_start]**反馈:** 销毁后展示黑色幽默共鸣语 [cite: 22]。

### [cite_start]Feature 3: 群体共鸣仪表盘 (Global Dashboard) [cite: 23]
* [cite_start]**数据:** 实时显示全球/区域“废”度百分比及发泄次数 [cite: 24, 25, 26]。
* [cite_start]**裂变:** 支持数据卡片一键截图分享 [cite: 27]。

### [cite_start]Feature 4: 多语言支持 (i18n) [cite: 28]
* [cite_start]**语言:** 简体中文 (zh-CN) + 英式英语 (en-GB) [cite: 29]。
* [cite_start]**逻辑:** 根据系统自动切换，共鸣语库需根据文化差异分别编写 [cite: 30, 31]。

---

## [cite_start]3. 核心数据结构 (Data Schema) [cite: 34]

| Table | Field | Type | Note |
| :--- | :--- | :--- | :--- |
| **users** | id, device_id, locale, region | UUID, STRING, ENUM, ENUM | [cite_start]匿名用户，不需注册 [cite: 37] |
| **check_ins** | id, user_id, level, date | UUID, FK, INT, DATE | [cite_start]每日唯一打卡 [cite: 39] |
| **vent_logs** | id, user_id, char_count | UUID, FK, INT | [cite_start]只记字数，不存内容 [cite: 41] |

---

## [cite_start]4. 技术栈推荐 [cite: 64]
* [cite_start]**Frontend:** React Native (Expo) [cite: 65]
* [cite_start]**Backend:** Supabase (PostgreSQL + Realtime) [cite: 65]
* [cite_start]**Animation:** Lottie (用于销毁动画) [cite: 65]
* [cite_start]**Cache:** Redis (用于实时聚合统计) [cite: 65]

---

## [cite_start]5. 变现与风险 [cite: 56, 67]
* [cite_start]**变现:** 付费下载 (低价) + 额外销毁动画包内购 [cite: 57]。
* [cite_start]**风险:** 需明确声明“非医疗建议”，集成心理援助热线 [cite: 68]。