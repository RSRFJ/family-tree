# 上游项目与改动说明 / Upstream & Changes

## 上游

- 项目：[qiaoshouqing/familytree](https://github.com/qiaoshouqing/familytree)
- 许可证：MIT
- 版权：Copyright (c) 2025 qiaoshouqing

## 关系声明

本仓库是上述项目的**修改版本（modified version / derivative work）**，
不是原创项目，也不声称对原项目拥有版权。

保留的部分：
- 家谱展示的产品思路与页面结构
- `seed/family-data.json` 示例数据
- 原项目的 MIT 许可与版权声明（见 `LICENSE-UPSTREAM`）

## 主要改动

| 方面 | 上游 | 本仓库 |
|---|---|---|
| 数据存储 | 单文件 JSON | PostgreSQL 17 + 迁移脚本 |
| 鉴权 | 可伪造的 base64 token | scrypt 密码 + 服务端会话 + 角色 |
| 预览 | 无 | 多访问码、只读预览、12 小时会话 |
| 权限 | 无 | admin / user 两级，页面 + API 双重校验 |
| 人物维护 | 只读 | 增删改查、回收站、撤销 |
| 关系 | 仅父系、易断链 | 防环触发器、世代自动重算、乐观锁 |
| 审计 | 无 | 操作日志、分页筛选、保留一年 |
| 备份 | 无 | 每日 `.dump`（7 份）+ JSON 导出/导入 |
| 部署 | Vercel | Docker Compose（web/db/migrate/seed/backup） |
| 界面 | 桌面为主 | 可收起侧边栏 + 手机抽屉 + 公告 |

## 许可

本仓库同样以 MIT 发布；原项目许可全文见 `LICENSE-UPSTREAM`。
