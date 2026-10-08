# 기술 선택 기록

## 2026-10-08 — 첫 iPhone 버전

- **앱 UI: React Native + Expo + TypeScript.** 화면과 일반 메모 흐름을 빠르게 다듬을 수 있고, Expo 개발 빌드에서 Swift 확장을 함께 사용할 수 있다.
- **기기 저장: SQLite (`expo-sqlite`).** 메모는 계정이나 서버 없이 오프라인에서 바로 열고 수정해야 한다. 메모·폴더·상태를 관계형 테이블로 관리하고, 위젯도 같은 로컬 DB를 읽고 쓴다. PostgreSQL 서버는 두지 않는다.
- **iCloud: Swift + CloudKit private database.** 사용자 본인의 Apple 계정 안에서 동기화하므로 앱 자체 로그인이나 별도 백엔드가 필요 없다. 앱이 오프라인일 때 먼저 SQLite에 기록한 뒤 연결이 복구되면 동기화한다.
- **홈 화면 위젯: Swift + WidgetKit + App Intents.** 위젯에서 앱을 열지 않고 투두를 완료해야 하므로 iOS 위젯 타깃과 App Intent를 사용한다. 위젯과 앱은 App Group 컨테이너 안의 SQLite DB를 공유한다.
- **최소 지원 버전: iOS 17.** 위젯의 상호작용형 App Intent와 앱 확장 구성을 첫 버전 범위로 묶기 위해 설정했다.
- **충돌 처리: 양쪽 메모를 보존.** 동기화 기준 시각보다 양쪽 데이터가 모두 새로우면 기기 메모를 충돌 사본으로 남기고 CloudKit 버전을 적용한다.

### 확인 범위

Expo lint, TypeScript 타입 검사, iOS Simulator용 앱 및 WidgetKit 타깃 빌드, 메모 작성 화면 진입까지 확인했다. 현재 Simulator 빌드는 Xcode의 ad hoc 서명이라 App Group·iCloud entitlement가 포함되지 않는다. CloudKit 동기화와 홈 화면 위젯의 공유 DB 동작은 Apple 개발 서명 및 실제 기기 설정 후 검증해야 한다.
