# Leitor da Escrivaninha 📖🕯️

Web application moderna e imersiva para leitura de arquivos PDF, simulando a experiência táctil e visual de um livro físico aberto sobre uma escrivaninha aconchegante.

## ✨ Recursos

- **Experiência Skewmórfica Imersiva**: Simulação de livro aberto com texturas de papel, vinheta de iluminação e ambiente escrivaninha.
- **Física de Virada de Página**: Efeito de dobra e sombra em 3D nas transições de página (`page-flip`).
- **100% Client-Side & Privado**: Os arquivos PDF são processados e renderizados localmente no navegador via **PDF.js** — nenhum dado ou documento é enviado para servidores externos.
- **Suporte Offline & PWA**: Compatível com Progressive Web App, podendo ser instalado no desktop ou dispositivo móvel.
- **Modos e Temas**: Alternância entre tema noturno (*Luz de Vela*) e tema diurno (*Manhã de Inverno*).
- **Responsivo & Zoom/Pan**: Adaptação para telas pequenas (modo página única), com suporte a zoom e pan suave sem corte de conteúdo.
- **Persistência de Sessão**: Lembra o último progresso e permite retomar a leitura onde você parou via IndexedDB/Storage.

## 🛠️ Stack Tecnológica

- **Core**: HTML5, TypeScript, Vanilla CSS (CSS Variables, animações 3D GPU-accelerated).
- **Bundler**: [Vite](https://vitejs.dev/)
- **PDF Engine**: [PDF.js](https://mozilla.github.io/pdf.js/)
- **PWA**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (v18+ recomendado)
- npm ou yarn

### Instalação e Execução

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Gerar build de produção
npm run build

# Pré-visualizar build de produção
npm run preview
```

## 📄 Licença

Este projeto está licenciado sob os termos da licença MIT.
