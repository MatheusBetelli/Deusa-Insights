# Deusa Analytics Angular

Aplicacao Angular paralela para migracao gradual do frontend React.

## Escopo desta fase

- Login real usando `POST /auth/login`.
- Validacao de sessao usando `GET /auth/me`.
- Rota protegida `/app`.
- Layout interno simples com sidebar/header placeholder.
- Services e models iniciais preparados para futuras migracoes.

Esta aplicacao nao migra dashboard, leads ou mapa nesta fase.

## Rodar localmente

Com backend rodando em `http://127.0.0.1:3001`:

```bash
cd frontend
npm install
npm start
```

Frontend Angular:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```
