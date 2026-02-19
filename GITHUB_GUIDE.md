# GitHub バージョン管理セットアップガイド

このプロジェクトをGitHubで管理するための手順を説明します。

---

## 🚀 セットアップ手順

### 前提条件
- GitHubアカウントを持っている
- Gitがローカルにインストールされている
- コマンドライン（ターミナル/コマンドプロンプト）が使える

---

## ステップ1: GitHubでリポジトリを作成

1. **GitHubにログイン**: https://github.com
2. **新規リポジトリ作成**:
   - 右上の「+」アイコン → "New repository" をクリック
3. **リポジトリ情報を入力**:
   - Repository name: `boatrace-odds-viewer` (任意の名前)
   - Description: `競艇複勝オッズリアルタイム表示アプリ`
   - Public または Private を選択
   - **"Initialize this repository with a README" はチェックしない**
4. **"Create repository"** をクリック

---

## ステップ2: ローカルでGit初期化

プロジェクトフォルダをダウンロードし、ターミナル/コマンドプロンプトで以下を実行:

```bash
# プロジェクトディレクトリに移動
cd /path/to/your/project

# Gitリポジトリを初期化
git init

# すべてのファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: 競艇複勝オッズ表示アプリ"
```

---

## ステップ3: GitHubリポジトリと連携

GitHubで作成したリポジトリのURLを使用（例: `https://github.com/your-username/boatrace-odds-viewer.git`）

```bash
# リモートリポジトリを追加
git remote add origin https://github.com/your-username/boatrace-odds-viewer.git

# メインブランチ名を設定（最近のGitではmainがデフォルト）
git branch -M main

# GitHubにプッシュ
git push -u origin main
```

**認証が求められた場合:**
- GitHubのユーザー名とパスワード（Personal Access Token）を入力

---

## ステップ4: .gitignoreファイルの作成

不要なファイルをGit管理から除外するため、`.gitignore`ファイルを作成:

```bash
# .gitignoreファイルを作成
touch .gitignore
```

`.gitignore`の内容:
```
# Node modules (バックエンド構築時に必要)
node_modules/
npm-debug.log
yarn-error.log

# 環境変数
.env
.env.local

# ビルド成果物
dist/
build/

# OS関連
.DS_Store
Thumbs.db

# エディタ関連
.vscode/
.idea/
*.swp
*.swo
*~

# ログファイル
*.log

# 一時ファイル
tmp/
temp/
```

`.gitignore`を追加してコミット:
```bash
git add .gitignore
git commit -m "Add .gitignore"
git push
```

---

## 📋 日常的なGit操作

### ファイルを変更した後

```bash
# 変更内容を確認
git status

# 変更をステージング
git add .

# コミット（変更内容を記録）
git commit -m "機能追加: 投票データ表示機能"

# GitHubにプッシュ
git push
```

### ブランチを使った開発（推奨）

```bash
# 新機能開発用ブランチを作成
git checkout -b feature/vote-data

# 開発・変更を実施
# ... ファイル編集 ...

# コミット
git add .
git commit -m "Add vote data display feature"

# GitHubにプッシュ
git push -u origin feature/vote-data

# GitHubでPull Requestを作成してmainにマージ
```

---

## 🌿 ブランチ戦略（推奨）

### main (メインブランチ)
- 本番環境にデプロイされる安定版
- 直接コミットせず、Pull Requestを通じてマージ

### develop (開発ブランチ)
- 開発中の最新コード
- 機能ブランチはここから作成

### feature/* (機能ブランチ)
- 新機能開発用
- 例: `feature/vote-data`, `feature/api-integration`

### bugfix/* (バグ修正ブランチ)
- バグ修正用
- 例: `bugfix/odds-display-error`

---

## 📝 コミットメッセージのルール

わかりやすいコミットメッセージを書くことが重要です。

### フォーマット例
```
[種類] 簡潔な説明

詳細な説明（必要に応じて）
```

### 種類の例
- `feat`: 新機能追加
- `fix`: バグ修正
- `docs`: ドキュメント更新
- `style`: コードフォーマット（機能に影響なし）
- `refactor`: リファクタリング
- `test`: テスト追加
- `chore`: ビルド設定など

### 具体例
```bash
git commit -m "feat: 投票票数・投票金額の表示機能を追加"
git commit -m "fix: オッズ更新時のエラーハンドリングを修正"
git commit -m "docs: README.mdにAPI仕様を追記"
```

---

## 🔐 GitHub Personal Access Token の作成

GitHubへのプッシュ時にパスワード認証が使えなくなったため、Personal Access Tokenが必要です。

### 作成手順
1. GitHubにログイン
2. 右上のプロフィールアイコン → **Settings**
3. 左メニュー最下部の **Developer settings**
4. **Personal access tokens** → **Tokens (classic)**
5. **Generate new token** → **Generate new token (classic)**
6. トークン名を入力（例: `boatrace-project`）
7. スコープを選択:
   - `repo` (リポジトリへのフルアクセス)
8. **Generate token** をクリック
9. **表示されたトークンをコピーして安全に保存**（二度と表示されません）

### 使い方
```bash
# プッシュ時にユーザー名とトークンを入力
git push
Username: your-github-username
Password: ghp_xxxxxxxxxxxxxxxxxxxx（コピーしたトークン）
```

---

## 📂 推奨ディレクトリ構造

```
boatrace-odds-viewer/
├── .git/                   # Git管理用（自動生成）
├── .gitignore              # Git除外設定
├── index.html              # メインHTML
├── css/
│   └── style.css           # スタイルシート
├── js/
│   └── main.js             # JavaScript
├── docs/
│   ├── PRODUCTION_GUIDE.md # 本番リリースガイド
│   └── GITHUB_GUIDE.md     # このファイル
├── README.md               # プロジェクト概要
└── package.json            # 依存関係（バックエンド構築時）
```

---

## 🎯 GitHub活用のメリット

### バージョン管理
- コード変更履歴を完全に記録
- いつでも過去の状態に戻せる

### コラボレーション
- 複数人での開発が容易
- Pull Requestでコードレビュー

### バックアップ
- クラウド上に安全に保存
- PCが壊れてもコードは守られる

### デプロイ連携
- GitHub ActionsでCI/CD構築可能
- GitHub Pagesで静的サイトをホスティング

---

## 🚀 GitHub Pagesでの公開（オプション）

静的サイトを無料でホスティングできます。

### 手順
1. GitHubリポジトリページで **Settings** をクリック
2. 左メニューの **Pages** をクリック
3. **Source** で `main` ブランチを選択
4. **Save** をクリック
5. 数分後、`https://your-username.github.io/boatrace-odds-viewer/` でアクセス可能

**注意**: GitHub Pagesは静的サイトのみ対応。バックエンドAPIは別途必要。

---

## 🆘 困ったときのコマンド

```bash
# 変更を取り消したい（コミット前）
git checkout -- filename

# 最後のコミットを取り消したい
git reset --soft HEAD^

# リモートの最新を取得
git pull

# ブランチ一覧を表示
git branch -a

# 特定のファイルの変更履歴を確認
git log -- filename

# 現在の変更差分を確認
git diff
```

---

## 📞 サポート

Git/GitHubでお困りの際は、以下を参照してください:

- **GitHub公式ドキュメント**: https://docs.github.com/ja
- **Git公式ドキュメント**: https://git-scm.com/doc
- **GitHub Learning Lab**: https://lab.github.com/

---

このガイドに従ってセットアップすれば、プロジェクトのバージョン管理が簡単に始められます！

何かご不明点があればお気軽にお聞きください。
