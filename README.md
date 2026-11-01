# 은총마켓 (VS Code + GitHub Pages + Firebase)

성당에서 은총표로 선물을 교환하는 모바일 쇼핑몰입니다. 현금 결제는 없습니다.

## 폴더 구성

- `index.html`: 학생·관리자 화면
- `style.css`: 반응형 디자인
- `app.js`: 로그인, 상품, 선착순 즉시 교환, 은총표 거래
- `firebase-config.js`: Firebase 웹 앱 연결 값
- `firestore.rules`: 학생별 접근 통제, 관리자 권한
- `firebase.json`: 규칙 배포 설정
- `images/`: 실제 상품 사진 보관

## 실제 상품 사진 사용

1. VS Code 프로젝트의 `images` 폴더에 사진을 넣습니다. 예: `images/pencil.jpg`
2. 관리자 → 상품 관리 → **상품 사진 경로**에 `images/pencil.jpg`를 입력합니다.
3. 저장하면 이모지 대신 해당 사진이 표시됩니다. 파일 이름의 대소문자는 정확히 맞추세요.
4. GitHub Pages에 올린 경우 **사진을 추가한 뒤 GitHub에도 파일을 push**해야 다른 휴대폰에서 보입니다.
5. 사진은 JPG, PNG, WebP 등을 권장하며 크기는 1MB 이하로 줄이면 로딩에 유리합니다.

기존 버전에서 새로 업데이트한다면 `firestore.rules`의 `imageUrl` 필드 허용 규칙도 다시 배포해야 사진 경로를 저장할 수 있습니다.
- `.github/workflows/pages.yml`: GitHub Pages 자동 배포

## 1. Firebase 프로젝트 만들기

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트를 생성합니다.
2. **프로젝트 설정 → 앱 추가 → 웹 앱(</>)** 을 등록합니다.
3. 웹 앱의 `firebaseConfig` 값을 `firebase-config.js`에 입력합니다. Firebase Web API Key는 공개 가능한 클라이언트 설정이며 **서비스 계정 키는 넣으면 안 됩니다.**
4. **Authentication → Sign-in method → 이메일/비밀번호** 를 활성화합니다.
5. **Firestore Database**를 생성합니다. 테스트 모드를 계속 유지하지 마세요.
6. 터미널에서 `npm install -g firebase-tools` 및 `firebase login`을 진행한 뒤 `firebase use --add`로 해당 프로젝트를 선택합니다.
7. 프로젝트 폴더에서 `firebase deploy --only firestore:rules`로 보안 규칙을 배포합니다.

> 학생용 로그인은 `아이디@students.eunchong.example` 형태의 내부 이메일을 Firebase Auth에 등록합니다. 실제로 이메일을 발송하지 않으며 학생은 아이디만 입력합니다. 이메일 기반 비밀번호 재설정 대신 담당자가 계정을 재발급하거나 관리해야 합니다.

## 2. 첫 관리자 등록 (반드시 필요)

처음에는 클라이언트에서 스스로 관리자가 될 수 없도록 막혀 있습니다.

1. **Firebase Authentication → Users → Add user**에서 담당자의 **실제 이메일 주소**와 6자 이상 비밀번호로 계정을 만듭니다.
2. 생성된 사용자의 **UID**를 복사합니다.
3. Firestore → `users` 컬렉션에서 문서 ID를 정확히 해당 UID로 만들어 다음 필드를 입력합니다.

| 필드 | 형식 | 값 |
|---|---|---|
| `name` | string | 담당자 이름 |
| `username` | string | admin |
| `role` | string | admin |
| `balance` | number | 0 |
| `active` | boolean | true |

관리자는 웹 로그인에서 자신이 등록한 **실제 이메일 주소**를 아이디 칸에 넣습니다. 학생은 발급된 아이디만 입력합니다.

## 3. VS Code에서 실행

- 폴더를 VS Code로 엽니다.
- **Live Server** 확장 프로그램으로 `index.html`을 실행합니다.
- Firebase를 연결하기 전에도 예시 상품 화면은 볼 수 있습니다. 실제 로그인·교환은 연결 후 가능합니다.

## 4. GitHub Pages에 배포

1. 새 GitHub 저장소를 만듭니다.
2. VS Code 터미널에서 아래 명령으로 업로드합니다. 저장소 주소는 본인 것으로 변경합니다.

```bash
git init
git add .
git commit -m "Build Eunchong Market with Firebase"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

3. GitHub 저장소 **Settings → Pages → Build and deployment → GitHub Actions**를 선택합니다.
4. `main` 브랜치가 업데이트되면 Actions에서 자동 배포됩니다.
5. Firebase Authentication의 **Settings → Authorized domains**에 `USERNAME.github.io` 도메인을 추가합니다.

GitHub Pages 프로젝트 주소 예시: `https://USERNAME.github.io/REPOSITORY/`

## 학생·관리자 흐름

1. 상품 목록은 로그인하지 않아도 볼 수 있지만, 은총표 교환에는 로그인이 필요합니다.
2. 관리자가 학생 아이디·비밀번호를 발급합니다.
3. 관리자가 은총표를 지급합니다.
4. 학생이 **교환하기** 버튼을 누르면 Firestore 트랜잭션으로 **잔액과 재고를 동시에 확인·차감**합니다.
5. 재고가 0개면 자동으로 **품절**이 표시되며, 거의 동시에 마지막 상품을 누르더라도 성공한 한 명에게만 재고가 배정됩니다.
6. 관리자는 교환을 승인할 필요가 없고, 선물을 전달한 뒤 **수령 완료**만 표시합니다.

**필수 배포 설정:** 공개 상품 목록을 로그인 없이 불러오려면 최신 `firestore.rules` 내용을 Firebase 콘솔의 **Firestore Database → 규칙**에 붙여넣어 **게시**해야 합니다. 학생 정보·은총표 변경·교환은 계속 로그인 권한으로 보호됩니다. GitHub Pages에 업로드한 `images/` 파일도 공개되므로 민감한 사진을 넣지 마세요.

## 상품 삭제

1. 관리자 → **상품 관리 → 등록된 상품**에서 **삭제**를 누르고 확인합니다.
2. 교환 기록이 없는 상품은 삭제됩니다. 기존 교환 기록이 있는 상품은 기록 보존을 위해 **상품 공개 해제(비공개)**로 처리됩니다.
3. **중요:** 상품 삭제 기능을 사용하려면 변경된 `firestore.rules`를 Firebase 콘솔의 **Firestore Database → 규칙**에 붙여넣고 **게시**해야 합니다. GitHub에 웹 파일만 올려서는 보안 규칙이 바뀌지 않습니다.

## 운영 주의 사항

- 학생 개인정보는 가급적 최소한으로 저장하세요. 주민등록번호, 생년월일, 연락처는 수집하지 않습니다.
- 학생 비밀번호는 Firebase Authentication이 관리하며 Firestore에는 저장되지 않습니다.
- 공개 GitHub 저장소에도 Firebase 웹 설정은 포함될 수 있지만, **서비스 계정 비밀키·관리자 비밀번호·로그인 토큰은 절대 커밋하지 마세요.**
- 계정 생성 중 Firestore 저장이 실패하면 인증 계정 제거를 시도하지만, 네트워크 단절 시 고아 계정이 남을 수 있으므로 Firebase Console에서 확인하세요.
- 현재 학생 비밀번호 재설정·계정 비활성화는 Firebase Console에서 담당자가 처리합니다.
- 모든 지급·교환 기록은 Firestore에 보존됩니다. 실제 사용 전 **특히 두 학생이 마지막 재고 1개를 동시에 교환하는 테스트**와 Firestore 규칙 배포 검증을 진행하세요.
- 비용·무료 할당량은 Firebase 요금제와 사용량에 따라 달라집니다.
