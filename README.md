# Bionovis

## Requisitos

- Node.js >= 16.6.0
- Npm >= 7.19.1

https://nodejs.org/en/download/

## Instruções
### Preparação
- git clone https://github.com/RI5TI/Bionovis.git
- cd Bionovis
- npm i

### Start Dev
- npm run start-dev

### Build Prod
- npm run pack

O build de produção irá gerar um diretório bionovis-win32-x64 que não precisa ser enviado ao repositório

## Configurações

### Dev

Em modo de desenvolvimento as configurações de exibição da aplicação e conexão com o banco de dados podem ser definidas no arquivo /config.json

### Prod

No build de produção o arquivo de configurações fica localizado em /resources/app/config.json