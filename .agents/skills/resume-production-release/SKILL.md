---
name: resume-production-release
description: Retoma a entrega de producao interrompida do Deusa Insights a partir do checkpoint versionado, incluindo commits restantes, validacao final e envio autorizado para a main. Use somente ao continuar esta entrega especifica.
---

# Retomar entrega de producao

Leia integralmente [references/checkpoint.md](references/checkpoint.md) antes de modificar arquivos, criar commits ou acessar o remoto.

Trate o checkpoint como registro do estado observado, nao como substituto para verificacao atual. Primeiro compare `git status`, `git log` e a divergencia entre `main` e `origin/main` com o documento. Preserve os commits existentes e todas as mudancas do usuario.

Continue pela menor etapa pendente indicada no checkpoint. Respeite estas invariantes:

- mantenha o dataset comercial, leads, coordenadas, migrations aplicadas e banco local sem mutacao;
- nao execute seed, reset, sincronizacao, descoberta em lote ou chamadas pagas;
- nao enfraqueca autenticacao, autorizacao, rate limit ou congelamento de dados;
- valide a imagem Docker, o frontend e a sequencia completa de migracoes antes de declarar prontidao;
- diferencie repositorio pronto para deploy de deploy efetivamente realizado.

Antes de enviar ao GitHub, atualize a referencia remota e interrompa se houver commits novos em `origin/main`. Um push posterior exige que a solicitacao ativa ainda autorize a alteracao externa; nunca force o envio. Depois do push, confira a igualdade dos SHAs e o resultado do CI quando estiver acessivel.

Ao concluir ou encontrar divergencia, atualize o checkpoint para refletir apenas fatos verificados.
