const messages: Record<string, string> = {
  'The operation could not be completed.': 'Não foi possível concluir a operação.',
  'Saving failed. Your local copy is retained.': 'Falha ao salvar. Sua cópia local foi preservada.',
  'Move or resize items to make room for another note.':
    'Mova ou redimensione os itens para abrir espaço para outra nota.',
  'A backup attachment exceeds restore limits.':
    'Um anexo do backup excede os limites de restauração.',
  'A current document version is required.': 'É necessária uma versão atual do documento.',
  'A current schema revision is required.': 'É necessária a revisão atual do esquema.',
  'A font needs a family and a source URL.':
    'Uma fonte precisa de uma família e uma URL de origem.',
  'A formula must be text.': 'Uma fórmula deve ser texto.',
  'A page cannot be moved into its own subtree.':
    'Uma página não pode ser movida para sua própria subárvore.',
  'A page parent is missing.': 'A página pai não foi encontrada.',
  'A page revision is required to edit a record title.':
    'É necessária uma revisão da página para editar o título de um registro.',
  'A production email transport must be connected before enabling invitations.':
    'É necessário conectar um serviço de e-mail de produção antes de habilitar convites.',
  'A record is missing its canonical data.': 'Um registro está sem seus dados canônicos.',
  'A record revision is required.': 'É necessária uma revisão do registro.',
  'A stable creation request ID is required.':
    'É necessário um ID estável para a solicitação de criação.',
  'A supported copy operation and stable request ID are required.':
    'São necessários uma operação de cópia compatível e um ID estável de solicitação.',
  'A template can contain up to 200 owned pages.':
    'Um modelo pode conter até 200 páginas próprias.',
  'A template must have one root and an owned page tree.':
    'Um modelo deve ter uma raiz e uma árvore de páginas própria.',
  'A valid appearance revision is required.': 'É necessária uma revisão válida da aparência.',
  'A view revision is required.': 'É necessária uma revisão da visualização.',
  'A workspace must keep at least one owner.':
    'Um espaço de trabalho deve manter pelo menos um proprietário.',
  'An action must update an active stored property.':
    'Uma ação deve atualizar uma propriedade armazenada ativa.',
  'An archived attachment is invalid or missing.':
    'Um anexo do arquivo é inválido ou está ausente.',
  'An archived canvas contains invalid or incompatible content.':
    'Um quadro do arquivo contém conteúdo inválido ou incompatível.',
  'An archived cover must reference its own image attachment.':
    'Uma capa do arquivo deve fazer referência a um anexo de imagem próprio.',
  'An archived page is invalid or too large.': 'Uma página do arquivo é inválida ou grande demais.',
  'An archived record template must reference its database schema.':
    'Um modelo de registro do arquivo deve fazer referência ao esquema do seu banco de dados.',
  'An archived schema or record is missing.': 'Um esquema ou registro do arquivo está ausente.',
  'An archived template must have one root and an owned page tree.':
    'Um modelo do arquivo deve ter uma raiz e uma árvore de páginas própria.',
  'An archived view is invalid.': 'Uma visualização do arquivo é inválida.',
  'An embedded file is unavailable or still uploading.':
    'Um arquivo incorporado está indisponível ou ainda está sendo enviado.',
  'Another request advanced this import. Resume to load its latest progress.':
    'Outra solicitação avançou esta importação. Retome para carregar o progresso mais recente.',
  'Appearance changed in another window. Reload the latest settings before retrying.':
    'A aparência mudou em outra janela. Recarregue as configurações mais recentes antes de tentar novamente.',
  'Appearance must be an object.': 'A aparência deve ser um objeto.',
  'Apply one property operation at a time.': 'Aplique uma operação de propriedade por vez.',
  'Archive entries exceed the allowed paths, count, or size.':
    'Os itens do arquivo excedem os caminhos, a quantidade ou o tamanho permitidos.',
  'Archive properties to preserve their definitions and values.':
    'Arquive as propriedades para preservar suas definições e valores.',
  'Attachment export exceeds the beta archive budget.':
    'A exportação de anexos excede o limite de arquivo da versão beta.',
  'Attachment not found.': 'Anexo não encontrado.',
  'Choose a cover color or a page image with a valid position.':
    'Escolha uma cor de capa ou uma imagem da página com uma posição válida.',
  'Choose a destination in this workspace.': 'Escolha um destino neste espaço de trabalho.',
  'Choose a destination.': 'Escolha um destino.',
  'Choose a document in the same workspace.': 'Escolha um documento no mesmo espaço de trabalho.',
  'Choose a record template.': 'Escolha um modelo de registro.',
  'Choose a saved web source to preview.': 'Escolha um código web salvo para visualizar.',
  'Choose a saved website to export.': 'Escolha um documento salvo para exportar.',
  'Choose a supported document creation operation.':
    'Escolha uma operação de criação de documento compatível.',
  'Choose a template root.': 'Escolha a raiz de um modelo.',
  'Choose a valid destination.': 'Escolha um destino válido.',
  'Choose a valid page visibility.': 'Escolha uma visibilidade válida para a página.',
  'Choose a valid parent page.': 'Escolha uma página pai válida.',
  'Choose a valid sibling.': 'Escolha uma página irmã válida.',
  'Choose a valid visibility.': 'Escolha uma visibilidade válida.',
  'Choose an accessible record in this workspace.':
    'Escolha um registro acessível neste espaço de trabalho.',
  'Choose an active date property.': 'Escolha uma propriedade de data ativa.',
  'Choose an active record property.': 'Escolha uma propriedade de registro ativa.',
  'Choose an active stored property.': 'Escolha uma propriedade armazenada ativa.',
  'Choose an available property action.': 'Escolha uma ação de propriedade disponível.',
  'Choose an uploaded image belonging to this page.':
    'Escolha uma imagem enviada que pertença a esta página.',
  'Choose one character or emoji for the page icon.':
    'Escolha um caractere ou emoji para o ícone da página.',
  'Choose one default edit or reset invalid defaults.':
    'Edite um valor padrão ou redefina os valores padrão inválidos.',
  'Close older website previews before starting another.':
    'Feche as prévias anteriores do site antes de iniciar outra.',
  'Connect a page in the same workspace.': 'Conecte uma página no mesmo espaço de trabalho.',
  'Copy within the selected workspace.': 'Copie dentro do espaço de trabalho selecionado.',
  'Create database records with the record command.':
    'Crie registros no banco de dados usando o comando de registro.',
  'Database children must be records.':
    'As páginas filhas de um banco de dados devem ser registros.',
  'Database not found.': 'Banco de dados não encontrado.',
  'Enter a valid email address.': 'Informe um endereço de e-mail válido.',
  'Expanded archive exceeds the import limit.':
    'O arquivo descompactado excede o limite de importação.',
  'Expected an object.': 'Era esperado um objeto.',
  'Files must be 25 MiB or smaller.': 'Os arquivos devem ter no máximo 25 MiB.',
  'Finish or resume existing imports first.':
    'Conclua ou retome as importações existentes primeiro.',
  'Finish or resume the existing imports before starting another.':
    'Conclua ou retome as importações existentes antes de iniciar outra.',
  'Group by an active select or checkbox property.':
    'Agrupe por uma propriedade ativa de seleção ou caixa de seleção.',
  'Invalid archived property flag.': 'Indicador de propriedade arquivada inválido.',
  'Invalid database ownership.': 'Propriedade do banco de dados inválida.',
  'Invalid document identity.': 'Identidade do documento inválida.',
  'Invalid file size.': 'Tamanho de arquivo inválido.',
  'Invalid navigation window.': 'Janela de navegação inválida.',
  'Invalid overview date.': 'Data da visão geral inválida.',
  'Invalid page cursor.': 'Cursor de página inválido.',
  'Invalid preview path.': 'Caminho de prévia inválido.',
  'Invalid record ownership.': 'Propriedade do registro inválida.',
  'Invalid template cursor.': 'Cursor de modelo inválido.',
  'Invalid template property ID.': 'ID de propriedade do modelo inválido.',
  'Invite members as admin, editor, or viewer.':
    'Convide membros como administrador, editor ou leitor.',
  'Member not found.': 'Membro não encontrado.',
  'Move pages within their template, or use the template to create independent pages.':
    'Mova as páginas dentro do modelo ou use o modelo para criar páginas independentes.',
  'Move source files out of the reserved .note folder before exporting.':
    'Mova os arquivos de código para fora da pasta reservada .note antes de exportar.',
  'Name this version using 1–120 characters.':
    'Dê um nome a esta versão usando de 1 a 120 caracteres.',
  'Only owners can manage ownership.': 'Somente proprietários podem gerenciar a propriedade.',
  'Page properties must fit within 64 KiB.':
    'As propriedades da página devem ocupar no máximo 64 KiB.',
  'Parent belongs to another workspace.': 'A página pai pertence a outro espaço de trabalho.',
  'Properties need string IDs and names.': 'As propriedades precisam de IDs e nomes de texto.',
  'Properties need unique IDs, names, and supported types.':
    'As propriedades precisam de IDs e nomes exclusivos e de tipos compatíveis.',
  'Property values cannot contain null characters.':
    'Os valores das propriedades não podem conter caracteres nulos.',
  'Provide a structured document.': 'Forneça um documento estruturado.',
  'Quoted context must be at most 1000 characters.':
    'O contexto citado deve ter no máximo 1.000 caracteres.',
  'Record defaults require a database reference.':
    'Os valores padrão do registro exigem uma referência a um banco de dados.',
  'Record not found in this database.': 'Registro não encontrado neste banco de dados.',
  'Record not found.': 'Registro não encontrado.',
  'Record properties belong to their database.':
    'As propriedades dos registros pertencem ao banco de dados.',
  'Record properties must use their database schema.':
    'As propriedades dos registros devem usar o esquema do banco de dados.',
  'Record templates belong to their owning database.':
    'Os modelos de registro pertencem ao banco de dados correspondente.',
  'Record templates use their database schema.':
    'Os modelos de registro usam o esquema do banco de dados.',
  'Record values must be an object.': 'Os valores do registro devem ser um objeto.',
  'Records must belong to a database.': 'Os registros devem pertencer a um banco de dados.',
  'Records remain inside their owning database.':
    'Os registros permanecem dentro do banco de dados correspondente.',
  'Recover into a private root page.': 'Recupere em uma página raiz privada.',
  'Relations must target accessible records in this workspace.':
    'As relações devem apontar para registros acessíveis neste espaço de trabalho.',
  'Reopen this discussion before replying.': 'Reabra esta discussão antes de responder.',
  'Resolve up to 100 valid page references.': 'Resolva até 100 referências de página válidas.',
  'Review this saved default; its property, option or relation changed.':
    'Revise este valor padrão salvo: sua propriedade, opção ou relação mudou.',
  'Review this template’s defaults: a database property, option or relation changed.':
    'Revise os valores padrão deste modelo: uma propriedade, opção ou relação do banco de dados mudou.',
  'Save template roots in the template library.':
    'Salve as raízes dos modelos na biblioteca de modelos.',
  'Save templates in the template library.': 'Salve os modelos na biblioteca de modelos.',
  'Select properties need valid options.': 'As propriedades de seleção precisam de opções válidas.',
  'Sign in to open your workspace.': 'Entre para abrir seu espaço de trabalho.',
  'Source file not found.': 'Arquivo de código não encontrado.',
  'Template attachments exceed the 64 MiB / 500-file copy budget.':
    'Os anexos do modelo excedem o limite de cópia de 64 MiB ou 500 arquivos.',
  'Template content exceeds the 16 MiB copy budget.':
    'O conteúdo do modelo excede o limite de cópia de 16 MiB.',
  'Template defaults must fit within 64 KiB.':
    'Os valores padrão do modelo devem ocupar no máximo 64 KiB.',
  'Template defaults need supported typed values.':
    'Os valores padrão do modelo precisam de valores de tipos compatíveis.',
  'Template defaults require a database reference.':
    'Os valores padrão do modelo exigem uma referência a um banco de dados.',
  'Template descendants must share their root.':
    'As páginas descendentes de um modelo devem compartilhar a mesma raiz.',
  'The account changed. Reopen templates before continuing.':
    'A conta mudou. Reabra os modelos antes de continuar.',
  'The archive contains a hierarchy cycle.': 'O arquivo contém um ciclo na hierarquia.',
  'The backup exceeds the expanded restore budget.':
    'O backup excede o limite de restauração após a descompactação.',
  'The backup manifest exceeds the 32 MiB restore budget.':
    'O manifesto do backup excede o limite de restauração de 32 MiB.',
  'The compressed backup exceeds 64 MiB.': 'O backup compactado excede 64 MiB.',
  'The database properties changed. Review the current defaults before saving.':
    'As propriedades do banco de dados mudaram. Revise os valores padrão atuais antes de salvar.',
  'The destination changed. Choose a sibling in the same location.':
    'O destino mudou. Escolha uma página irmã no mesmo local.',
  'The document contains too many nodes.': 'O documento contém nós demais.',
  'The formula is too long.': 'A fórmula é longa demais.',
  'The imported content does not match this page type.':
    'O conteúdo importado não corresponde a este tipo de página.',
  'The page changed. Reload before moving it.': 'A página mudou. Recarregue antes de movê-la.',
  'The page changed. Reload it before saving again.':
    'A página mudou. Recarregue antes de salvar novamente.',
  'The properties changed. Review the latest schema and retry.':
    'As propriedades mudaram. Revise o esquema mais recente e tente novamente.',
  'The property is unavailable or archived.': 'A propriedade está indisponível ou arquivada.',
  'The signed-in account changed. Reopen local recovery before continuing.':
    'A conta conectada mudou. Reabra a recuperação local antes de continuar.',
  'The source changed while copying. Retry to use its latest content.':
    'O conteúdo de origem mudou durante a cópia. Tente novamente para usar o conteúdo mais recente.',
  'The source is still saving or changed. Run the current saved source again.':
    'O código ainda está sendo salvo ou mudou. Execute novamente o código salvo atual.',
  'The template contains too many blocks.': 'O modelo contém blocos demais.',
  'The uploaded byte count does not match the file. Retry the upload.':
    'A quantidade de bytes enviados não corresponde ao arquivo. Tente enviar novamente.',
  'The web source was removed or moved.': 'O código web foi removido ou movido.',
  'The website source was removed or moved.': 'O código do documento foi removido ou movido.',
  'This action is unavailable.': 'Esta ação está indisponível.',
  'This asset does not belong to the previewed page.':
    'Este recurso não pertence à página da prévia.',
  'This attachment is still uploading.': 'Este anexo ainda está sendo enviado.',
  'This canvas could not be imported without losing its structure.':
    'Não foi possível importar este quadro sem perder sua estrutura.',
  'This creation request already belongs to a different document state.':
    'Esta solicitação de criação já pertence a um estado diferente do documento.',
  'This default changed while you were editing. Review its latest value.':
    'Este valor padrão mudou durante a edição. Revise o valor mais recente.',
  'This discussion changed. Refresh before updating it.':
    'Esta discussão mudou. Recarregue antes de atualizá-la.',
  'This discussion is unavailable.': 'Esta discussão está indisponível.',
  'This document changed. Review the latest version before restoring.':
    'Este documento mudou. Revise a versão mais recente antes de restaurar.',
  'This document contains unsupported or invalid blocks.':
    'Este documento contém blocos incompatíveis ou inválidos.',
  'This document exceeds the creation size limit.':
    'Este documento excede o limite de tamanho para criação.',
  'This document exceeds the current size limit.':
    'Este documento excede o limite de tamanho atual.',
  'This document update is too large.': 'Esta atualização do documento é grande demais.',
  'This export exceeds the beta limit of 5,000 pages.':
    'Esta exportação excede o limite de 5.000 páginas da versão beta.',
  'This graph center is unavailable.': 'Este centro do grafo está indisponível.',
  'This import is unavailable.': 'Esta importação está indisponível.',
  'This invitation belongs to another account.': 'Este convite pertence a outra conta.',
  'This invitation has expired or was already used.': 'Este convite expirou ou já foi utilizado.',
  'This is not a supported Note workspace archive.':
    'Este não é um arquivo de espaço de trabalho Note compatível.',
  'This location belongs to another workspace.': 'Este local pertence a outro espaço de trabalho.',
  'This media does not belong to the exported page.': 'Esta mídia não pertence à página exportada.',
  'This move changes access. Confirm the visibility change.':
    'Esta movimentação altera o acesso. Confirme a alteração de visibilidade.',
  'This page contains invalid or incompatible content.':
    'Esta página contém conteúdo inválido ou incompatível.',
  'This page is not a database.': 'Esta página não é um banco de dados.',
  'This page is still being restored. Finish its import before copying it.':
    'Esta página ainda está sendo restaurada. Conclua a importação antes de copiá-la.',
  'This page is unavailable.': 'Esta página não está disponível.',
  'This page was restored. Run its current source again.':
    'Esta página foi restaurada. Execute novamente seu código atual.',
  'This property changed while you were editing. Review the latest value before saving.':
    'Esta propriedade mudou durante a edição. Revise o valor mais recente antes de salvar.',
  'This record changed. Reload it before editing again.':
    'Este registro mudou. Recarregue antes de editar novamente.',
  'This recovered document belongs to an older generation.':
    'Este documento recuperado pertence a uma geração anterior.',
  'This request already belongs to a different copy operation.':
    'Esta solicitação já pertence a outra operação de cópia.',
  'This request belongs to a different creation operation.':
    'Esta solicitação pertence a outra operação de criação.',
  'This request origin is not allowed.': 'A origem desta solicitação não é permitida.',
  'This saved version is unavailable.': 'Esta versão salva está indisponível.',
  'This source is unavailable.': 'Este conteúdo de origem está indisponível.',
  'This template’s database is unavailable in this workspace.':
    'O banco de dados deste modelo está indisponível neste espaço de trabalho.',
  'This view changed or was removed. Reload before editing it.':
    'Esta visualização mudou ou foi removida. Recarregue antes de editá-la.',
  'This view changed or was removed. Reload before removing it.':
    'Esta visualização mudou ou foi removida. Recarregue antes de removê-la.',
  'This website preview expired or stopped.':
    'Esta prévia do documento expirou ou foi interrompida.',
  'This website preview is unavailable.': 'Esta prévia do documento está indisponível.',
  'This workspace has reached its storage allowance.':
    'Este espaço de trabalho atingiu o limite de armazenamento.',
  'Unknown page type.': 'Tipo de página desconhecido.',
  'Unknown preview origin.': 'Origem da prévia desconhecida.',
  'Unknown visibility.': 'Visibilidade desconhecida.',
  'Unknown workspace role.': 'Função do espaço de trabalho desconhecida.',
  'Unsupported archive structure or schema version.':
    'Estrutura de arquivo ou versão de esquema incompatível.',
  'Unsupported database layout.': 'Layout de banco de dados incompatível.',
  'Unsupported imported document structure.': 'Estrutura de documento importado incompatível.',
  'Unsupported saved document structure.': 'Estrutura de documento salvo incompatível.',
  'Use a description up to 2,000 characters.': 'Use uma descrição com até 2.000 caracteres.',
  'Use a quoted property name.': 'Use um nome de propriedade entre aspas.',
  'Use a resolution state and current discussion revision.':
    'Use um estado de resolução e a revisão atual da discussão.',
  'Use a short view name.': 'Use um nome curto para a visualização.',
  'Use a title between 1 and 300 characters.': 'Use um título entre 1 e 300 caracteres.',
  'Use a valid CSS color.': 'Use uma cor CSS válida.',
  'Use a valid calendar date range.': 'Use um intervalo de datas válido no calendário.',
  'Use a valid discussion filter.': 'Use um filtro de discussão válido.',
  'Use a valid font URL.': 'Use uma URL de fonte válida.',
  'Use a valid font family.': 'Use uma família de fonte válida.',
  'Use a valid page offset.': 'Use um deslocamento de página válido.',
  'Use an HTTP or HTTPS font source.': 'Use uma fonte com origem HTTP ou HTTPS.',
  'Use prop("Property name") or insert a property reference.':
    'Use prop("Nome da propriedade") ou insira uma referência de propriedade.',
  'Use the database record command for records.':
    'Use o comando de registro do banco de dados para registros.',
  'Use the workspace access endpoints.': 'Use os endpoints de acesso do espaço de trabalho.',
  'Use unique property names and valid property IDs.':
    'Use nomes de propriedade exclusivos e IDs de propriedade válidos.',
  'Use up to 50 font sources.': 'Use até 50 arquivos de fonte.',
  'Use up to 50 properties.': 'Use até 50 propriedades.',
  'Use up to 50 tags, each with 1 to 80 characters.':
    'Use até 50 etiquetas, cada uma com 1 a 80 caracteres.',
  'Use up to 50 template defaults.': 'Use até 50 valores padrão de modelo.',
  'Use up to 64 KB of custom CSS.': 'Use até 64 KB de CSS personalizado.',
  'Verify your email before accepting the invitation.':
    'Verifique seu e-mail antes de aceitar o convite.',
  'Website export supports up to 64 MiB including media.':
    'A exportação do site permite até 64 MiB, incluindo mídias.',
  'Workspace archives must be 64 MiB or smaller.':
    'Os arquivos de espaço de trabalho devem ter no máximo 64 MiB.',
  'Workspace storage is full. A new version cannot be saved.':
    'O armazenamento do espaço de trabalho está cheio. Não é possível salvar uma nova versão.',
  'You do not have access to this workspace or operation.':
    'Você não tem acesso a este espaço de trabalho ou operação.',
  'Use numbers, [property IDs], arithmetic, round, abs, min or max.':
    'Use números, [IDs de propriedades], aritmética, round, abs, min ou max.',
  'A formula must contain between 1 and 1,000 characters.':
    'Uma fórmula deve conter entre 1 e 1.000 caracteres.',
  'The formula is too complex.': 'A fórmula é complexa demais.',
  'Use at most 32 nested expressions.': 'Use no máximo 32 expressões aninhadas.',
  'Formulas cannot contain circular references.':
    'As fórmulas não podem conter referências circulares.',
  'Unknown property: {{id}}': 'Propriedade desconhecida: {{id}}',
  '{{name}} is derived and cannot be edited.':
    '{{name}} é uma propriedade derivada e não pode ser editada.',
  'Invalid value for {{name}}.': 'Valor inválido para {{name}}.',
  '{{name}} must contain between 1 and {{max}} characters.':
    '{{name}} deve conter entre 1 e {{max}} caracteres.',
  '{{key}} must be between {{min}} and {{max}}.': '{{key}} deve estar entre {{min}} e {{max}}.',
  'Unknown appearance option: {{key}}.': 'Opção de aparência desconhecida: {{key}}.',
  'The property name {{name}} is ambiguous. Insert its reference using a property button.':
    'O nome de propriedade {{name}} é ambíguo. Insira sua referência usando um botão de propriedade.',
  'Choose a numeric property for {{name}}.': 'Escolha uma propriedade numérica para {{name}}.',
  'Formula reference [{{ref}}] must be a numeric property.':
    'A referência de fórmula [{{ref}}] deve ser uma propriedade numérica.',
  'Invalid email or password': 'E-mail ou senha inválidos',
  'Invalid email or password.': 'E-mail ou senha inválidos.',
  'Invalid password': 'Senha inválida',
  'Invalid email': 'E-mail inválido',
  'Invalid email address': 'Endereço de e-mail inválido',
  'User not found': 'Usuário não encontrado',
  'User already exists': 'O usuário já existe',
  'User already exists. Use another email.': 'O usuário já existe. Use outro e-mail.',
  'Email not verified': 'E-mail não verificado',
  'Email is required': 'O e-mail é obrigatório',
  'Password is required': 'A senha é obrigatória',
  'Password too short': 'Senha curta demais',
  'Password too long': 'Senha longa demais',
  'Session expired': 'A sessão expirou',
  'Invalid session': 'Sessão inválida',
  'Session not found': 'Sessão não encontrada',
  Unauthorized: 'Não autorizado',
  'Not authenticated': 'Sem autenticação',
  'Authentication required': 'É necessário entrar na conta',
  'Failed to create user': 'Não foi possível criar o usuário',
  'Failed to create session': 'Não foi possível criar a sessão',
  'Failed to update user': 'Não foi possível atualizar o usuário',
  'Failed to get session': 'Não foi possível obter a sessão',
  'Invalid token': 'Token inválido',
  'Token expired': 'O token expirou',
  'Email verification required': 'É necessário verificar o e-mail',
  'Invalid credentials': 'Credenciais inválidas',
  'Invalid credentials.': 'Credenciais inválidas.',
  'Too many requests': 'Muitas solicitações',
  'Too many requests. Please try again later.': 'Muitas solicitações. Tente novamente mais tarde.',
  'User already exists.': 'O usuário já existe.',
  'Session expired. Re-authenticate to perform this action.':
    'A sessão expirou. Entre novamente para realizar esta ação.',
  'Invalid user': 'Usuário inválido',
  'Social account already linked': 'A conta social já está vinculada',
  'Provider not found': 'Provedor não encontrado',
  'id_token not supported': 'id_token incompatível',
  'Failed to get user info': 'Não foi possível obter as informações do usuário',
  'User email not found': 'E-mail do usuário não encontrado',
  'Email can not be updated': 'Não é possível atualizar o e-mail',
  'Change email is disabled': 'A alteração de e-mail está desabilitada',
  'Credential account not found': 'Conta com credenciais não encontrada',
  "You can't unlink your last account": 'Não é possível desvincular sua última conta',
  'Account not found': 'Conta não encontrada',
  'User already has a password. Provide that to delete the account.':
    'O usuário já tem uma senha. Informe-a para excluir a conta.',
  'Cross-site navigation login blocked. This request appears to be a CSRF attack.':
    'A entrada por navegação entre sites foi bloqueada. Esta solicitação parece ser um ataque CSRF.',
  "Verification email isn't enabled": 'O e-mail de verificação não está habilitado',
  'Email is already verified': 'O e-mail já foi verificado',
  'Email mismatch': 'O e-mail não corresponde',
  'Session is not fresh': 'A sessão precisa ser renovada',
  'Linked account already exists': 'A conta vinculada já existe',
  'Invalid origin': 'Origem inválida',
  'Invalid callbackURL': 'callbackURL inválida',
  'Invalid redirectURL': 'redirectURL inválida',
  'Invalid errorCallbackURL': 'errorCallbackURL inválida',
  'Invalid newUserCallbackURL': 'newUserCallbackURL inválida',
  'Missing or null Origin': 'Origem ausente ou nula',
  'callbackURL is required': 'callbackURL é obrigatória',
  'Unable to create verification': 'Não foi possível criar a verificação',
  'Field not allowed to be set': 'Não é permitido definir este campo',
  'Validation Error': 'Erro de validação',
  'Field is required': 'O campo é obrigatório',
  'Body must be an object': 'O corpo deve ser um objeto',
  'User already has a password set': 'O usuário já tem uma senha definida',
};
export default messages;
