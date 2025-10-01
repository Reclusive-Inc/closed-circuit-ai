# chat

This directory contains the source for the default chat app bundled with closed-circuit-ai.

A copy of this app will be automatically unpacked into workspaces, and those unpacked files are intended to be modified by users directly within their workspace. Hard versioning (e.g. `/chat/v1/...`) is used to ensure ccai-authored app updates will never clobber user-authored changes.

This app also serves as a template for users to fork and create their own ccai-compatible apps.

## rebuild source
```
npm install

npm run build
```
