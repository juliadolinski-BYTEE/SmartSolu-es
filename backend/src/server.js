import dotenv from 'dotenv';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { rotasDeAutenticacao } from './auth.js';

// ==================================================
// 1. CONFIGURACOES E VARIÁVEIS DE AMBIENTE
// ==================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PASTA_PROJETO = path.resolve(__dirname, '../../');
const PASTA_FRONTEND = path.join(PASTA_PROJETO, 'frontend');
const ARQUIVO_HTML = path.join(PASTA_FRONTEND, 'index.html');
const ARQUIVO_ENV = path.join(PASTA_PROJETO, '.env');

dotenv.config({ path: ARQUIVO_ENV });

const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const ARQUIVO_ITENS = path.join(__dirname, 'itens.json');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Frontend estático
app.use(express.static(PASTA_FRONTEND));

// Rotas de Autenticação
rotasDeAutenticacao(app);

// ==================================================
// 2. LEITURA E GRAVAÇÃO DO BANCO DE DADOS (JSON)
// ==================================================

async function lerItens() {
    try {
        const conteudo = await readFile(ARQUIVO_ITENS, 'utf8');
        const itens = JSON.parse(conteudo);
        return Array.isArray(itens) ? itens : [];
    } catch (erro) {
        if (erro.code === 'ENOENT') {
            await salvarListaItens([]);
            return [];
        }
        throw erro;
    }
}

async function salvarListaItens(itens) {
    await writeFile(ARQUIVO_ITENS, JSON.stringify(itens, null, 2), 'utf8');
}

async function salvarItem(dados) {
    const itens = await lerItens();
    const novoItem = {
        id: Date.now(),
        tipo: dados.tipo,
        item: dados.item,
        local: dados.local,
        desc: dados.desc || '',
        dataRegistro: new Date().toISOString(),
        status: 'Pendente'
    };
    itens.push(novoItem);
    await salvarListaItens(itens);
    return novoItem;
}

// ==================================================
// 3. REGEX, NORMALIZAÇÃO E BUSCA INTELIGENTE (EM JS)
// ==================================================

function clean(value) {
    return String(value ?? '').trim();
}

function normalize(value) {
    return clean(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const stopWords = new Set([
    'eu', 'me', 'meu', 'minha', 'minhas', 'meus', 'o', 'a', 'os', 'as', 'um', 'uma',
    'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'por', 'para',
    'com', 'e', 'que', 'foi', 'perdi', 'perdido', 'perdida', 'perder', 'procuro',
    'procurando', 'buscar', 'busca', 'achei', 'achou', 'encontrou', 'encontrei',
    'tem', 'tinha', 'existe', 'algum', 'alguma', 'sobre', 'perto', 'onde', 'como'
]);

const synonyms = {
    penal: ['penal', 'estojo', 'porta lapis', 'estojo escolar'],
    mochila: ['mochila', 'bolsa', 'mochila escolar'],
    carteira: ['carteira', 'porta moedas'],
    celular: ['celular', 'telefone', 'smartphone'],
    garrafa: ['garrafa', 'squeeze', 'garrafinha'],
    chave: ['chave', 'chaves', 'chaveiro'],
    fone: ['fone', 'fone de ouvido', 'auricular'],
    casaco: ['casaco', 'jaqueta', 'blusa']
};

const objectWords = [
    'penal', 'estojo', 'mochila', 'bolsa', 'carteira', 'celular', 'telefone',
    'garrafa', 'squeeze', 'chave', 'chaves', 'fone', 'oculos', 'casaco', 'jaqueta',
    'caderno', 'livro', 'caneta', 'lapis'
];

const searchPhrases = /\b(perdi|perdeu|perdido|perdida|procuro|procurando|buscar|busca|encontrou|encontrado|achei|achou)\b/;

function expandTerms(text) {
    const normalizedText = normalize(text);
    const terms = new Set(
        normalizedText.split(' ').filter(word => word.length > 1 && !stopWords.has(word))
    );

    for (const [mainTerm, variations] of Object.entries(synonyms)) {
        const mentioned = variations.some(v => normalizedText.includes(normalize(v)));
        if (mentioned) {
            terms.add(mainTerm);
            for (const v of variations) {
                normalize(v).split(' ').forEach(w => {
                    if (w.length > 1 && !stopWords.has(w)) terms.add(w);
                });
            }
        }
    }
    return [...terms];
}

function looksLikeSearch(message) {
    const text = normalize(message);
    return objectWords.some(word => text.includes(normalize(word))) || searchPhrases.test(text);
}

async function searchItemsInDatabase(query) {
    const terms = expandTerms(query);
    if (!terms.length) return [];

    const items = await lerItens();

    return items.filter(item => {
        // Pega todos os nomes possíveis dos campos para não ter erro
        const nomeObj = item.item || item.nome || item.name || '';
        const localObj = item.local || item.localizacao || item.location || '';
        const descObj = item.desc || item.descricao || item.description || item.detalhes || '';

        const textoCompleto = normalize(`${nomeObj} ${localObj} ${descObj}`);

        // Retorna se ao menos um dos termos expandidos (ex: estojo, penal) estiver no texto
        return terms.some(term => textoCompleto.includes(term));
    });
}

function formatSearchReply(matches) {
    if (matches.length === 0) {
        return 'Consultei os registros do sistema e não encontrei nenhum item correspondente. Se desejar, você pode registrar esse item no painel.';
    }

    const lista = matches.map((item, index) => {
        const tipo = item.tipo ? item.tipo.toUpperCase() : 'REGISTRO';
        return `${index + 1}. [${tipo}] ${item.item} | Local: ${item.local} ${item.desc ? `| Obs: ${item.desc}` : ''}`;
    }).join('\n');

    return `Encontrei ${matches.length} possível(is) correspondência(s) nos registros:\n\n${lista}`;
}

// ==================================================
// 4. CHATBOT COM BUSCA AUTOMÁTICA EM JS + OLLAMA
// ==================================================

app.post('/api/chat', async (req, res) => {
    try {
        const message = clean(req.body?.message || req.body?.historicoMensagens?.slice(-1)[0]?.content);
        const history = Array.isArray(req.body?.history) ? req.body.history : [];

        if (!message) {
            return res.status(400).json({ erro: 'Digite uma mensagem.' });
        }

        // 1. O JavaScript verifica se a mensagem é uma busca
        const userMessages = history.filter(h => h.role === 'user').map(h => h.content);
        const combinedText = [...userMessages, message].join(' ');

        if (looksLikeSearch(message) || (userMessages.length > 0 && looksLikeSearch(combinedText))) {
            const matches = await searchItemsInDatabase(combinedText);
            const resposta = formatSearchReply(matches);

            return res.json({
                respostaDaIA: resposta,
                reply: resposta,
                matches
            });
        }

        // 2. Se for conversa geral, delega para o Ollama
        const systemPrompt = `
Você é o assistente virtual do CEEP Curitiba para achados e perdidos.
Responda de forma curta, cortês e direta em português brasileiro.
Ajude o usuário e oriente-o a informar o nome e o local do objeto.
`;

        const responseOllama = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                stream: false,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.slice(-6),
                    { role: 'user', content: message }
                ],
                options: { temperature: 0.3, num_predict: 120 }
            }),
            signal: AbortSignal.timeout(15000) // Cancela se demorar mais de 15s
        });

        if (!responseOllama.ok) {
            throw new Error(`Erro no Ollama: HTTP ${responseOllama.status}`);
        }

        const data = await responseOllama.json();
        const reply = data.message?.content?.trim() || 'Como posso te ajudar com os achados e perdidos?';

        return res.json({
            respostaDaIA: reply,
            reply: reply
        });

    } catch (erro) {
        console.error('Erro no chatbot:', erro.message);
        return res.status(200).json({
            respostaDaIA: 'Estou com dificuldades para conectar com o servidor da IA no momento, mas você pode consultar a lista de itens no painel principal!',
            reply: 'Erro ao conectar à IA.'
        });
    }
});

// ==================================================
// 5. ROTAS DE API E INICIALIZAÇÃO
// ==================================================

app.get('/api/itens', async (req, res) => {
    try {
        const itens = await lerItens();
        return res.json(itens);
    } catch (erro) {
        return res.status(500).json({ erro: 'Erro ao ler itens.' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(ARQUIVO_HTML);
});

// Rota definitiva para salvar itens cadastrados pelo formulário do site
app.post('/api/itens', async (req, res) => {
    try {
        const dados = req.body;
        
        const nomeItem = dados.item || dados.name || dados.nome;
        const localItem = dados.local || dados.location || dados.localizacao;
        const descItem = dados.desc || dados.description || dados.descricao || '';
        const tipoItem = dados.tipo || dados.status || 'perdido';

        if (!nomeItem || !localItem) {
            return res.status(400).json({ erro: 'O nome do item e o local são obrigatórios.' });
        }

        const itens = await lerItens();
        
        const novoItem = {
            id: Date.now(),
            tipo: String(tipoItem).toLowerCase().includes('encontrado') ? 'encontrado' : 'perdido',
            item: nomeItem,
            nome: nomeItem,
            local: localItem,
            desc: descItem,
            descricao: descItem,
            dataRegistro: new Date().toISOString(),
            status: tipoItem
        };

        itens.push(novoItem);
        await salvarListaItens(itens);

        return res.status(201).json({ sucesso: true, item: novoItem });
    } catch (erro) {
        console.error('Erro ao salvar item pelo site:', erro.message);
        return res.status(500).json({ erro: 'Não foi possível salvar o item.' });
    }
});

app.delete('/api/itens/:id', async (req, res) => {
    try {
        const idParaRemover = Number(req.params.id);
        let itens = await lerItens();
        
        const tamanhoAntes = itens.length;
        itens = itens.filter(item => Number(item.id) !== idParaRemover);

        if (itens.length === tamanhoAntes) {
            return res.status(404).json({ erro: 'Item não encontrado.' });
        }

        await salvarListaItens(itens);
        return res.json({ sucesso: true, mensagem: 'Item removido com sucesso.' });
    } catch (erro) {
        console.error('Erro ao remover item:', erro);
        return res.status(500).json({ erro: 'Erro interno ao remover item.' });
    }
});

app.listen(PORT, () => {
    console.log('');
    console.log('============================================');
    console.log(` Servidor rodando na porta: ${PORT}`);
    console.log(` Modelo configurado: ${MODEL}`);
    console.log('============================================');
    console.log('');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});