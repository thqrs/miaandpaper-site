# Histórico · Humanização do Tom e Limpeza de Linguagem Corporativa

**Data:** 31 de Agosto de 2026  
**Contexto:** Auditoria e eliminação de vestígios de linguagem corporativa, clichés de marketing, impessoalidade e fórmulas burocráticas no site da Mia & Paper, alinhando todos os textos com a voz artesanal, calorosa, simples e direta da Mia.

---

## 1. Princípios Aplicados

1. **Primeira pessoa singular ("eu / comigo / pela Mia"):** Eliminação do plural majestático ou de empresa ("nós", "connosco", "ajudam-nos", "feitos por nós", "ou um representante").
2. **Consistência de género:** Corrigido "Obrigado" para "Obrigada" (a Mia é mulher e assina no feminino).
3. **Eliminação de "No-Reply" e jargão de suporte:** Fórmulas de call center ou de helpdesk foram substituídas por formas naturais de contacto ("Como este envio é automático, se precisares de alterar alguma coisa fala diretamente com a Mia...").
4. **Simplificação de faturas e RGPD:** Textos alarmistas ou puramente jurídicos ("consumidor final", "serão imprimidos", "após confirmação do pagamento") foram reescritos em tom simples e correto em PT-PT.
5. **Terminologia artesanal vs industrial:** Substituição de "Add-ons" por "Extras", "Laminação" por "Acabamento", e "produção em pequena escala" por "trabalho manual e artesanal".
6. **Remoção de placeholders de desenvolvimento:** Textos internos de mockup substituídos por descrições orientadas ao visitante.

---

## 2. Registo Detalhado de Alterações (Antes vs Depois)

### A. Contacto e Envio de Mensagens (`site/send-message.php`)

| Antes | Depois |
|---|---|
| `Mensagem enviada. A Mia, ou um representante, vai entrar em contacto contigo em breve.` | `Mensagem enviada. A Mia vai responder-te assim que puder!` |
| `Recebemos as mensagens que enviaste há pouco. Espera um bocado antes de enviar outra, ou fala connosco pelo Instagram.` | `Recebemos as mensagens que enviaste há pouco. Espera um momento antes de enviar outra, ou fala diretamente com a Mia pelo Instagram.` |
| `O servidor não conseguiu enviar o email. Tenta novamente ou envia mensagem pelo Instagram.` | `Não foi possível enviar a tua mensagem agora. Tenta de novo daqui a pouco ou fala com a Mia pelo Instagram.` |
| `Mensagem enviada. A Mia, ou um representante, vai entrar em contacto contigo em breve. Podes voltar à página inicial ou fazer outro pedido.` | `Mensagem enviada! A Mia vai responder-te assim que puder. Se precisares, podes voltar à página inicial.` |

---

### B. Confirmação e Emails de Encomenda (`site/send-order.php`)

| Antes | Depois |
|---|---|
| `Precisas de fazer alguma alteração à tua encomenda ou tens alguma dúvida?\nNão respondas a este email, porque esta caixa não é monitorizada.\nUsa o nosso formulário de contacto:` | `Precisas de alterar alguma coisa ou tens alguma dúvida?\nComo este endereço é de envio automático, fala diretamente com a Mia pelo formulário de contacto ou pelo Instagram @miaandpaper:` |
| `entra em contacto connosco.` | `fala diretamente com a Mia.` |
| `entraremos em contacto contigo para pedir ou devolver a diferença` | `a Mia fala contigo para acertar qualquer diferença` |
| `Obrigado pela tua encomenda.` | `Obrigada pela tua encomenda!` |
| `Obrigado pelo teu pedido. Em breve a Mia vai entrar em contacto contigo com os detalhes do pagamento.` | `Obrigada pelo teu pedido! A Mia vai falar contigo em breve para acertarem os detalhes do pagamento e do envio.` |
| `A Mia vai entrar em contacto contigo com os próximos passos.` | `A Mia vai falar contigo em breve para acertar os detalhes.` |
| `Dados que vão ser usados para preencher o Cartão de Apresentação:` | `Texto para o teu Cartão de Apresentação:` |
| `$customerCopySubject = 'Recebemos o teu pedido (' . $orderCode . ') - Mia & Paper';` | `$customerCopySubject = 'Obrigada pela tua encomenda! (' . $orderCode . ') · Mia & Paper';` |
| `<span>© Mia & Paper 2026 Todos os Direitos Reservados</span>` | `<span>© Mia & Paper 2026</span>` |

---

### C. Chatbot Míu (`site/content/miu-defaults.json` e `site/content/miu-quick-replies.json`)

| Ficheiro | Antes | Depois |
|---|---|---|
| `miu-defaults.json` | `"greeting": "Em que posso ajudar?"` | `"greeting": "Olá! Em que te posso dar uma ajuda?"` |
| `miu-defaults.json` | `a Mia confirma os próximos passos.` | `a Mia fala contigo com todos os detalhes.` |
| `miu-quick-replies.json` | `a morada e o valor final são confirmados depois por contacto directo.` | `a morada e os portes certos são combinados depois contigo por mensagem ou email.` |
| `miu-quick-replies.json` | `é confirmada depois por contacto directo.` | `a Mia combina a morada de entrega contigo a seguir.` |
| `miu-quick-replies.json` | `Se quiseres fatura com NIF, preenche-o; se deixares em branco, a fatura é emitida como consumidor final. A fatura é emitida após confirmação do pagamento.` | `Se quiseres fatura com NIF, basta colocares o número; se deixares em branco, a fatura é passada a consumidor final assim que o pagamento for confirmado.` |
| `miu-quick-replies.json` | `a Mia entra em contacto para confirmar o que faltar. A preparação só começa após confirmação do pagamento.` | `a Mia fala contigo para acertar o que faltar. A preparação começa assim que o pagamento estiver confirmado.` |
| `miu-quick-replies.json` | `a Mia contacta-te com o valor confirmado e os próximos passos.` | `a Mia envia-te mensagem com o valor final e combina o pagamento.` |
| `miu-quick-replies.json` | `Antes de submeter, podes voltar aos passos anteriores... nessa fase já não é garantido que a alteração seja possível.` | `Enquanto estás a preencher o pedido, podes voltar aos passos anteriores... se a produção ainda não tiver arrancado, é fácil ajustar.` |
| `miu-quick-replies.json` | `Estes campos destinam-se ao Cartão de Apresentação associado à encomenda; não são os dados de entrega.` | `Estes dados servem apenas para o Cartão de Apresentação do teu artigo; não são a morada de entrega.` |
| `miu-quick-replies.json` | `ou pedir que entrem em contacto contigo para explicares.` | `ou pedir para a Mia falar contigo e combinarem os detalhes.` |

---

### D. Perguntas Frequentes (`site/content/faqs.json`)

| Antes | Depois |
|---|---|
| `A encomenda só começa a ser preparada após confirmação do pagamento.` | `Começo a preparar tudo assim que o pagamento estiver confirmado.` |
| `Faz o pedido com, pelo menos, 7 dias de antecedência` | `Faz a tua encomenda com, pelo menos, 7 dias de antecedência` |
| `O formulário de cada produto mostra apenas as opções que se aplicam a esse artigo.` | `Na página de cada peça encontras apenas as opções disponíveis para esse modelo.` |
| `Usa o campo de envio de ficheiros durante a personalização e escolhe uma imagem com a melhor qualidade possível.` | `Podes carregar a tua imagem durante a personalização — escolhe um ficheiro com a melhor qualidade possível.` |
| `pergunta antes de enviares o pedido.` | `fala comigo antes de encomendares.` |
| `A preparação começa depois de os detalhes necessários e o pagamento estarem confirmados.` | `Começo a preparar a encomenda depois de termos todos os detalhes e o pagamento confirmados.` |
| `A morada e o valor final são confirmados depois por contacto directo.` | `Falamos depois para confirmar a tua morada e o valor final.` |
| `Posso alterar ou cancelar um pedido depois de o enviar?` | `Posso alterar ou cancelar uma encomenda depois de a enviar?` |
| `Se a qualidade não for suficiente para o resultado pretendido, entro em contacto contigo.` | `Se a imagem não tiver a qualidade ideal para imprimir, aviso-te logo.` |
| `Estas pequenas diferenças fazem parte de uma produção em pequena escala. Se uma cor ou medida for essencial para o teu pedido, confirma comigo antes de encomendar.` | `Estas pequenas diferenças são naturais e fazem parte do trabalho manual e artesanal. Se alguma cor ou detalhe for essencial para ti, confirma comigo antes de encomendares.` |

---

### E. Produtos do Catálogo (`site/content/products/*.json`) e Congressos (`site/congressos/2026/content/products/*.json`)

| Ficheiro | Antes | Depois |
|---|---|---|
| Geral (Cartão) | `Atenção: Estes dados pessoais serão imprimidos e colocados no Cartão de Apresentação...` | `Estes dados vão ser impressos no cartão que acompanha cada uma das tuas peças.` |
| Geral (Cartão) | `Estes dados ajudam-nos a tornar a tua encomenda única` | `Estes dados tornam a tua encomenda ainda mais pessoal` |
| Geral (Faturação) | `Se quiseres fatura com número de contribuinte, preenche este campo. Se deixares em branco, a fatura será emitida como consumidor final.` | `Se quiseres fatura com NIF, preenche este campo. Se deixares em branco, a fatura é emitida sem NIF.` |
| Geral (Faturação) | `A fatura será emitida após confirmação do pagamento. Se indicares email, enviamos por email. Se indicares telemóvel, podemos enviar por WhatsApp.` | `A fatura é emitida assim que o pagamento estiver confirmado. Se indicares email, envio por email; se indicares telemóvel, posso enviar por WhatsApp.` |
| Geral (Artwork) | `Inclui a preparação do ficheiro e os testes necessários antes da produção.` | `Inclui a preparação do teu ficheiro e os testes necessários antes de criar as peças.` |
| `agendas.json` | `"Add-ons"`, `"Queres acrescentar algum add-on?"`, `"Laminação"` | `"Extras"`, `"Queres acrescentar algum extra?"`, `"Acabamento"` |
| `cadernos-anuais.json` & `congressos/cadernos.json` | `Aqui podes mostrar uma fotografia ou mockup das páginas interiores do caderno anual. A imagem pode ser alterada no modo admin.` | `Vê como são as páginas interiores deste caderno.` |
| `imanes-loja.json` & `porta-chaves.json` | `para deixares a combinação connosco` | `para deixares a combinação comigo` |
| `pasta-de-folhetos.json` | `Mostramos apenas as combinações disponíveis para a capa que escolheste.` | `Aqui encontras apenas as combinações disponíveis para a capa que escolheste.` |
| `personalizacao.json` | `"Os teus designs, feitos por nós"` / `Preço de ajuste do design ao formato do produto.` | `"As tuas fotos e ideias, feitas à mão pela Mia"` / `Inclui o ajuste e a preparação cuidadosa do teu desenho para cada peça.` |

---

### F. Páginas Estáticas e Menu (`site/contacto.html`, `site/privacy.html`, `site/js/08-menu-site.js`)

| Ficheiro | Antes | Depois |
|---|---|---|
| `contacto.html` | `<span>© Mia & Paper 2026 Todos os Direitos Reservados</span>` | `<span>© Mia & Paper 2026 · Feito à mão em Portugal</span>` |
| `privacy.html` | `a Mia poderá pedir-te a morada de envio depois, por contacto direto.` | `a Mia pede-te a morada de entrega depois, por mensagem ou email.` |
| `privacy.html` | `A encomenda só começa a ser preparada após confirmação do pagamento. Quando o valor total está definido... a Mia entra em contacto contigo com os próximos passos.` | `A encomenda só começa a ser preparada depois de o pagamento estar confirmado. Quando o valor total já está fechado... a Mia fala contigo para confirmar os detalhes e combinar o pagamento.` |
| `privacy.html` | `usamos os dados fornecidos apenas para responder à tua mensagem ou acompanhar o assunto que nos enviaste.` | `os teus dados servem unicamente para a Mia te responder e esclarecer o que precisares.` |
| `privacy.html` | `Isto permite-nos relacionar pedidos enviados com sessões anteriores e perceber quando alguém desiste antes de chegar ao envio.` | `Isto ajuda a Mia a perceber quando alguém tem dificuldades no site e desiste antes de concluir a encomenda.` |
| `privacy.html` | `necessários para acompanhar o pedido e manter um histórico razoável de atendimento.` | `guardados no email da Mia e nos registos internos para acompanhar a tua encomenda e apoiar se voltares a falar connosco mais tarde.` |
| `08-menu-site.js` | `'<span>© ' + escapeHtml(brand || "Mia & Paper") + ' 2026 Todos os Direitos Reservados</span>'` | `'<span>© ' + escapeHtml(brand || "Mia & Paper") + ' 2026 · Feito à mão em Portugal</span>'` |
