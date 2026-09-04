# S1 往復ログ（自動生成 — `pnpm s1`）

判定基準: `docs/specs/s1-判定基準-手直しの保持.md`

**この表は測定値であって判定ではない。** 判定は `.claude/issues/001-*.md` の結果欄に書く。

| 往復 | 保持 Tier A | 保持 Tier B | 反映 | 競合 | 重なり |
|---|---|---|---|---|---|
| R1 | 1/1 | 12/12 | 3/3 | 0 | 0 |
| R2 | 3/3 | 13/13 | 3/3 | 0 | 0 |
| R3 | 3/3 | 14/14 | 2/2 | 0 | 0 |
| R4 | 3/3 | 14/14 | 0/0 | 1 | 0 |
| R5 | 3/3 | 14/14 | 0/0 | 1 | 0 |
| REAL-1 | 1/1 | 12/12 | 2/2 | 0 | 0 |
| REAL-2 | 1/1 | 12/12 | 2/2 | 1 | 0 |

## R1

**指示**: Redis を足して、Web からキャッシュ経路も引いて。

- 保持 Tier A: **1/1**
- 保持 Tier B: **12/12**
- 反映: **3/3**
- 競合: なし
- 人が選んだ側: （選択なし）
- 重なり: なし

```diff
+   - id: redis
+     type: cache
+     label: Redis
+     group: vpc
+ 
+   - from: web01
+     to: redis
+ 
+   - from: web02
+     to: redis
+ 
```

## R2

**指示**: Web を 3 台にして。

- 保持 Tier A: **3/3**
- 保持 Tier B: **13/13**
- 反映: **3/3**
- 競合: なし
- 人が選んだ側: （選択なし）
- 重なり: なし

```diff
+   - id: web03
+     type: server
+     label: Web 03
+     technology: Apache
+     group: vpc
+ 
+   - from: lb
+     to: web03
+ 
+   - from: web03
+     to: db
+ 
```

## R3

**指示**: バックアップは別基盤へ移したので、この図からは外して。

- 保持 Tier A: **3/3**
- 保持 Tier B: **14/14**
- 反映: **2/2**
- 競合: なし
- 人が選んだ側: （選択なし）
- 重なり: なし

```diff
-   - id: backup
-     type: storage
-     label: Backup Storage
- 
-   - from: replica
-     to: backup
- 
```

## R4

**指示**: DB は一番下に置いて。

- 保持 Tier A: **3/3**
- 保持 Tier B: **14/14**
- 反映: **0/0**
- 競合: [{"kind":"position-proposed","elementId":"db","human":{"x":620,"y":410},"ai":{"x":100,"y":1200}}]
- 人が選んだ側: human
- 重なり: なし

```diff
+     locked: true
```

## R5

**指示**: DB は一番下に置いて。（R4 と同じ指示をもう一度）

- 保持 Tier A: **3/3**
- 保持 Tier B: **14/14**
- 反映: **0/0**
- 競合: [{"kind":"position-suppressed","elementId":"db","ai":{"x":100,"y":1200}}]
- 人が選んだ側: （選択なし）
- 重なり: なし

```diff

```

## REAL-1

**指示**: Redis を足して、Web からキャッシュ経路も引いて。（実 AI 役 / real-ai-r1-proposal.yaml）

- 保持 Tier A: **1/1**
- 保持 Tier B: **12/12**
- 反映: **2/2**
- 競合: なし
- 人が選んだ側: （選択なし）
- 重なり: なし

```diff
+   - id: redis
+     label: Redis
+     type: cache
+     group: vpc
+ 
+   - from: web01
+     to: redis
+ 
+   - from: web02
+     to: redis
+ 
```

## REAL-2

**指示**: Redis を足して、Web からキャッシュ経路も引いて。（実 AI 役 / real-ai-r1-proposal-renamed.yaml）

- 保持 Tier A: **1/1**
- 保持 Tier B: **12/12**
- 反映: **2/2**
- 競合: [{"kind":"pin-orphaned","elementId":"db","reason":"removed"}]
- 人が選んだ側: （選択なし）
- 重なり: なし

```diff
+   - id: maindb
+     label: MariaDB
+     type: database
+     group: vpc
+ 
+   - id: redis
+     label: Redis
+     type: cache
+     group: vpc
+ 
+   - from: web01
+     to: maindb
+ 
+   - from: web02
+     to: maindb
+ 
+   - from: maindb
+     to: replica
+     label: replication
+ 
+   - from: web01
+     to: redis
+ 
+   - from: web02
+     to: redis
+ 
```
