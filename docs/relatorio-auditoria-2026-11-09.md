# Relatório de correções da auditoria — Mosaic

Este relatório consolida a auditoria e a etapa complementar solicitada em 09/11/2026. A etapa complementar substitui as pendências de idioma, CSS e tamanho dos módulos descritas no plano anterior.

| Problema observado | Correção implementada | Evidência |
| --- | --- | --- |
| Selects nativos destoavam do tema, inclusive no modo escuro | Componente compartilhado de seleção simples e múltipla, popup no topo da página, foco visível e aparência consistente | Testes de teclado, formulários, modais, multisseleção e contêiner transformado; uso real no navegador |
| Controles e indicadores sobrepostos em telas estreitas | Cabeçalho móvel, alvos de toque e indicadores reorganizados | Testes de áreas de clique e conferência a 390 × 844 |
| Erros residuais após excluir páginas e respostas antigas de workspace | Escritas de metadados aguardadas, erros vinculados à página e proteção contra respostas atrasadas | Testes de estado e reprodução de renomear e excluir imediatamente |
| Lixeira sem busca hierárquica e com renderização excessiva | Busca em descendentes, ordenação por exclusão recente, paginação e feedback individual de restauração | Testes de estado e fluxo real de restauração |
| Descoberta incompleta de conteúdo | Busca por quadros, páginas sem título nos recentes, links do grafo expostos à árvore acessível e limpeza de filtros | Testes de descoberta, navegação e grafo |
| Calendário vazio sem caminho direto para configurar datas | Ação que cria uma propriedade de data e a seleciona | E2E verifica definição persistida e grade do calendário |
| Orientações insuficientes em modelos e histórico | Estados vazios acionáveis; explicação dos intervalos do histórico e do salvamento contínuo | Testes de descoberta e fluxos de modelos/histórico |
| Enquadramento inconsistente do quadro entre telas | Câmeras por tamanho de viewport, ajuste inicial e captura correta de salvamentos adiados | Testes espaciais, touch e navegação |
| Convite sem escopo claro | Rótulos e orientação explícitos sobre o espaço de trabalho | Testes de interface e inspeção no navegador |
| Ausência de português por infraestrutura de localização | Catálogos pt-BR e inglês por mensagens de origem; preferência persistida; interpolação; Intl para datas, números e tempo relativo; atualização de componentes e node views sem remontar o editor | Testes de catálogo, parâmetros, armazenamento e fluxos bilíngues |
| Mensagens de validação apenas em inglês | Catálogo dos erros estáticos do servidor/pacotes, autenticação e padrões conhecidos com valores dinâmicos | Testes percorrem o código para verificar cobertura dos erros |
| Regras CSS sobrepostas e seletores dependentes do idioma | Remoção de declarações sobrescritas e seletores de selects nativos; consolidação da cascata e uso de atributos estáveis | 252 comparações de estilos computados e screenshots idênticos em fixtures de desktop/móvel |
| Chunk do editor de código acima de 500 kB | Separação do runtime, gramáticas e runtime de React em módulos cacheáveis | Build sem aumentar o limite de aviso; E2Es do editor também executados no build de produção |
| Modelo já salvo ficava bloqueado para cópia ao sair antes da confirmação por WebSocket | Consulta autorizada do snapshot durável; validação de página/geração; limpeza do indicador pendente somente por comparação atômica dos bytes locais. Conteúdo ainda não salvo, exclusões e alterações concorrentes continuam protegidos | Testes de autorização, versão, falha de rede e concorrência; E2E bloqueia confirmações reais do socket, sai do modelo e cria a cópia sem espera adicional |
| Erros genéricos e aviso de espaço no quadro não entravam na cobertura de idioma | Três traduções adicionadas; verificador agora percorre também os erros genéricos públicos do servidor e avisos locais do cliente | O novo teste falhou nas três mensagens antes da correção e passou após a correção |

## Uso e localização

O idioma pode ser alterado na tela de entrada ou em **Configurações → Conta → Idioma**. A escolha vale para este navegador e sincroniza abas abertas. Conteúdo autoral, nomes de propriedades, valores de seleção, arquivos e código conservam seus valores.

O teste bilíngue verifica que o mesmo elemento do editor permanece montado, mantém o texto e aceita novas edições após a troca; o conteúdo permanece após recarregar. Também verifica os menus de blocos, o componente web, o seletor de layout e a persistência da preferência.

## Medições

- CSS compilado: 161,43 → 151,08 kB.
- Chunk SourceView: 531,44 → cerca de 5,5 kB, com runtime e gramáticas separados. O runtime de código é o maior módulo, cerca de 388 kB.
- O editor de código continua fora do carregamento inicial. A divisão melhora a granularidade de carregamento e cache; não significa que o download total de todo o editor tenha diminuído na mesma proporção.

## Validação final

- `npm run check`: concluído com código de saída 0; TypeScript, ESLint, formatação, 293 testes em 58 arquivos e build de produção aprovados. Maior chunk JavaScript: 388,12 kB; nenhum limite de aviso foi aumentado.
- `npm run test:e2e`: suíte completa com **107/107 cenários aprovados**, código de saída 0, 6,5 minutos, com a aplicação congelada. O arquivo de resultado registra `passed` e nenhuma falha. Inclui a cópia sem confirmação por socket e o cenário original de modelos sem a espera extra.
- A condição de sincronização do modelo foi corrigida na aplicação. A espera extra de Saved foi retirada do teste original; o teste passou novamente. O novo teste bloqueia os frames de confirmação por WebSocket e confirma a cópia pelo estado durável autorizado via HTTP.
- Proteção do rascunho: os testes verificam bytes ainda não salvos, exclusão pendente, página/geração incorreta, resposta inválida, edição concorrente, falha de rede/autorização e mudança de conta/espaço. São 11 testes de durabilidade e autorização; todos aprovados na verificação focada.
- Testes específicos bilíngues: 3/3 aprovados, incluindo erro real de autenticação e conflito de validação de propriedades com nome autoral preservado.
- Avisos locais: mensagens são armazenadas na forma de origem e traduzidas ao renderizar. E2E mantém um erro de caminho de arquivo aberto ao alternar pt-BR → inglês → pt-BR e verifica a preservação do campo e do elemento do editor de código. O teste falhou com a implementação anterior reintroduzida e passou após a correção.
- Revisão independente: problema de tradução antecipada dos avisos corrigido; correção de durabilidade e autorização também revisada, sem problema importante identificado. Caso de título vazio coberto em teste unitário.
- Editor web: 4/4 E2Es também aprovados contra os arquivos compilados de produção.
- Conferência manual no navegador: dropdowns em temas claro/escuro, interface pt-BR, troca de idioma nas configurações e viewport 390 × 844. Screenshots 32, 33 e 34 na pasta de evidências desta sessão. Tema Sistema e viewport padrão restaurados.
- Cobertura adicional de erros: o teste agora percorre os erros genéricos públicos do servidor e os avisos locais. Três mensagens faltantes foram corrigidas. Verificação focada: 22 testes e lint aprovados.
- Estado do diff verificado com `git diff --check`; sem erros de whitespace. Alterações desta entrega agrupadas em commit local; o identificador é informado na resposta e pode ser consultado com `git log -1 --oneline`.

## Limites de cobertura

Houve uso real no navegador de desktop e verificação de teclado, semântica acessível e viewports móveis. Nesta etapa final, a retomada da ferramenta de navegador interativo foi interrompida antes da execução; os novos fluxos foram exercitados no Chromium pelo Playwright do projeto. O inventário disponível não ofereceu um celular físico conectado nem uma sessão de leitor de tela com saída verificável. Portanto, não foi realizado teste físico em Android/iOS nem validação auditiva com NVDA, Narrador ou VoiceOver. Emulação e árvore acessível não são apresentadas como substitutos desses testes.

Os testes delimitam os fluxos exercitados e não garantem a inexistência de defeitos desconhecidos.

Uma tentativa anterior de limpar a pasta isolada de testes `.runtime-select-review` foi bloqueada pela política automática. A pasta foi preservada e excluída apenas do status local do Git. A pasta de dados de desenvolvimento foi preservada.
