# mobile_app

A new Flutter project.

## API

The Android emulator uses `http://10.0.2.2:8000` by default. For a physical device,
set the API host to the computer's LAN address:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8000
```

The debug Android build allows HTTP for local development. Use an HTTPS URL for
release builds; never expose the development API over an untrusted network.

## Eventos

Los coordinadores pueden crear QRs de eventos desde la pestaña **Eventos**,
reutilizando nombres anteriores o escribiendo uno nuevo. El QR admite
asistencias de usuarios de cualquier centro durante 24 horas, o hasta que el
coordinador cierre el evento. Los usuarios registran su asistencia desde la
pestaña **Asistencia**.

Antes de ejecutar el backend con esta versión, aplica la migración nueva:

```powershell
alembic upgrade head
```

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
