let historicoMensagens = [];
let userRole = null;
let filtroAtual = 'todos';

// Lista dinâmica que carrega os dados reais do servidor
let bancoDeDadosItens = [];

const API = 'http://localhost:3000/api';

// Carrega os itens do servidor assim que a página abre
window.addEventListener('DOMContentLoaded', async () => {
    await carregarItensDoServidor();
});

async function carregarItensDoServidor() {
    try {
        const response = await fetch(`${API}/itens`);
        if (response.ok) {
            bancoDeDadosItens = await response.json();
            renderizarTabela();
        }
    } catch (error) {
        console.error('Erro ao carregar itens do servidor:', error);
    }
}

// ========================
// LOGIN
// ========================
async function autenticarUsuario(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    try {
        const response = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const dados = await response.json();

        if (!response.ok) {
            alert(dados.erro || 'Falha ao autenticar.');
            return;
        }

        userRole = dados.role;
        aplicarPermissoesDeAcesso();

        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';

        document.getElementById('form-login').reset();
    } catch (error) {
        console.error('Erro ao entrar:', error);
        alert(
            'Não foi possível conectar ao servidor. ' +
            'Verifique se o node server.js continua rodando.'
        );
    }
}

// ========================
// PERMISSÕES
// ========================
function aplicarPermissoesDeAcesso() {
    const botaoCadastrarMenu =
        document.getElementById('aba-menu-cadastrar');

    const badgeUsuario = document.getElementById('user-badge');

    if (userRole === 'admin') {
        if (botaoCadastrarMenu) {
            botaoCadastrarMenu.style.display = 'flex';
        }

        if (badgeUsuario) {
            badgeUsuario.innerText = '🛡️ Administrador';
            badgeUsuario.style.color = '#7209B7';
        }
    } else {
        if (botaoCadastrarMenu) {
            botaoCadastrarMenu.style.display = 'none';
        }

        if (badgeUsuario) {
            badgeUsuario.innerText = '🎓 Aluno / Usuário';
            badgeUsuario.style.color = '#A0A0AB';
        }

        mudarAbaPadrao('inicio');
    }

    carregarItensDoServidor();
}

// ========================
// SAIR DA CONTA
// ========================
function fazerLogout() {
    userRole = null;
    historicoMensagens = [];

    const app = document.getElementById('app-container');
    const login = document.getElementById('login-screen');

    if (app) app.style.display = 'none';
    if (login) login.style.display = 'flex';

    const mensagens = document.getElementById('chat-messages');

    if (mensagens) {
        mensagens.innerHTML = `
            <div class="message assistant">
                Olá! Sou o assistente virtual do CEEP.
                Como posso ajudar?
            </div>
        `;
    }

    mudarAbaPadrao('inicio');
}

// ========================
// CHATBOT
// ========================
async function enviarMensagem() {
    const input = document.getElementById('input-message');
    const texto = input.value.trim();

    if (!texto) return;

    input.value = '';
    input.disabled = true;

    const botaoEnviar = document.getElementById('btn-enviar');

    if (botaoEnviar) botaoEnviar.disabled = true;

    adicionarMensagemNaTela(texto, 'user');

    historicoMensagens.push({
        role: 'user',
        content: texto
    });

    try {
        const response = await fetch(`${API}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                historicoMensagens: historicoMensagens
            })
        });

        const dados = await response.json();

        if (!response.ok) {
            throw new Error(
                dados.erro || `Erro HTTP ${response.status}`
            );
        }

        const respostaIA = dados.respostaDaIA;

        if (!respostaIA) {
            throw new Error('O servidor não retornou uma resposta da IA.');
        }

        adicionarMensagemNaTela(respostaIA, 'assistant');

        historicoMensagens.push({
            role: 'assistant',
            content: respostaIA
        });

        // Atualiza os itens do servidor após a interação
        await carregarItensDoServidor();

    } catch (error) {
        console.error('Erro ao falar com a IA:', error);

        adicionarMensagemNaTela(
            'Não consegui obter uma resposta. Verifique o servidor ' +
            'e se o Ollama está funcionando.',
            'assistant'
        );
    } finally {
        input.disabled = false;

        if (botaoEnviar) botaoEnviar.disabled = false;

        input.focus();
    }
}

// Permite enviar a mensagem com Enter
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('input-message');

    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                enviarMensagem();
            }
        });
    }
});

function adicionarMensagemNaTela(texto, remetente) {
    const chatMessages = document.getElementById('chat-messages');

    if (!chatMessages) return;

    const div = document.createElement('div');
    div.classList.add('message', remetente);

    div.innerText = String(texto);

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ========================
// CADASTRO MANUAL
// ========================
async function cadastrarItemManual(event) {
    event.preventDefault();

    if (userRole !== 'admin') {
        alert('Somente administradores podem cadastrar itens.');
        return;
    }

    const novoItem = {
        tipo: document.getElementById('form-tipo').value,
        item: document.getElementById('form-item').value.trim(),
        local: document.getElementById('form-local').value.trim(),
        desc: document.getElementById('form-desc').value.trim() || 'Nenhuma observação adicional'
    };

    try {
        const response = await fetch(`${API}/itens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoItem)
        });

        const dados = await response.json();

        if (!response.ok) {
            alert(dados.erro || 'Erro ao salvar o item.');
            return;
        }

        // Atualiza a tabela buscando diretamente do servidor
        await carregarItensDoServidor();
        
        document.getElementById('form-cadastro').reset();
        alert(`Sucesso! Objeto registrado sob o protocolo #${dados.item.id}`);

    } catch (error) {
        console.error('Erro ao cadastrar item:', error);
        alert('Não foi possível conectar ao servidor para salvar o item.');
    }
}

// ========================
// TABELA DE ITENS
// ========================
function renderizarTabela() {
    const corpoTabela = document.getElementById('lista-itens-corpo');

    if (!corpoTabela) return;

    corpoTabela.innerHTML = '';

    const itensFiltrados = bancoDeDadosItens.filter((item) => {
        const tipoItem = item.tipo || 'perdido';
        return filtroAtual === 'todos' || tipoItem === filtroAtual;
    });

    itensFiltrados.forEach((registro) => {
        const tr = document.createElement('tr');
        const tipo = registro.tipo || 'perdido';
        const nomeItem = registro.item || registro.nome || '';
        const localItem = registro.local || '';
        const descItem = registro.desc || registro.descricao || '';
        const idItem = registro.id || '';

        const textoBotaoStatus =
            tipo === 'perdido'
                ? '🔄 Marcar como Achado'
                : '🔄 Marcar como Perdido';

        tr.innerHTML = `
            <td>#${idItem}</td>
            <td>
                <span class="badge ${tipo}">
                    ${tipo}
                </span>
            </td>
            <td class="item-nome"></td>
            <td class="item-local"></td>
            <td class="item-desc"
                style="color: var(--text-muted); font-size: 0.9rem;">
            </td>
            <td class="coluna-acao-item">
                <div class="acoes-admin-container"
                     style="display: ${
                         userRole === 'admin' ? 'flex' : 'none'
                     };">
                    <button class="btn-status"
                        onclick="alternarStatusObjeto(${idItem})">
                        ${textoBotaoStatus}
                    </button>
                    <button class="btn-remover"
                        onclick="removerObjeto(${idItem})">
                        Remover
                    </button>
                </div>
            </td>
        `;

        tr.querySelector('.item-nome').textContent = nomeItem;
        tr.querySelector('.item-local').textContent = localItem;
        tr.querySelector('.item-desc').textContent = descItem;

        corpoTabela.appendChild(tr);
    });

    const cabecalhoAcao =
        document.querySelector('.coluna-acao-admin');

    if (cabecalhoAcao) {
        cabecalhoAcao.classList.toggle(
            'ocultar-coluna',
            userRole !== 'admin'
        );
    }

    document.querySelectorAll('.coluna-acao-item').forEach((td) => {
        td.classList.toggle('ocultar-coluna', userRole !== 'admin');
    });
}

// ========================
// FILTROS
// ========================
function filtrarItens(tipoFiltro, evento) {
    filtroAtual = tipoFiltro;

    document.querySelectorAll('.btn-filtro').forEach((btn) => {
        btn.classList.remove('active');
    });

    const botao = evento?.target?.closest('.btn-filtro');

    if (botao) {
        botao.classList.add('active');
    }

    renderizarTabela();
}

// ========================
// ALTERAR STATUS
// ========================
function alternarStatusObjeto(idProtocolo) {
    if (userRole !== 'admin') {
        alert('Ação não autorizada!');
        return;
    }

    const itemEncontrado = bancoDeDadosItens.find(
        (item) => item.id === idProtocolo
    );

    if (!itemEncontrado) return;

    const statusAntigo = itemEncontrado.tipo;

    itemEncontrado.tipo =
        itemEncontrado.tipo === 'perdido' ? 'achado' : 'perdido';

    renderizarTabela();

    alert(
        `O protocolo #${idProtocolo} foi alterado de ` +
        `"${statusAntigo}" para "${itemEncontrado.tipo}".`
    );
}

// ========================
// REMOVER ITEM
// ========================
async function removerObjeto(idProtocolo) {
    if (userRole !== 'admin') {
        alert('Ação não autorizada!');
        return;
    }

    const confirmar = confirm(`Tem certeza que deseja remover o objeto #${idProtocolo}?`);
    if (!confirmar) return;

    try {
        const response = await fetch(`${API}/itens/${idProtocolo}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await carregarItensDoServidor();
            alert(`O item #${idProtocolo} foi excluído com sucesso.`);
        } else {
            alert('Não foi possível remover o item no servidor.');
        }
    } catch (error) {
        console.error('Erro ao remover:', error);
        alert('Erro de conexão ao tentar remover o item.');
    }
}

// ========================
// NAVEGAÇÃO ENTRE ABAS
// ========================
function mudarAba(nomeAba, evento) {
    document.querySelectorAll('.btn-aba').forEach((btn) => {
        btn.classList.remove('active');
    });

    const botaoClicado =
        evento?.target?.closest('.btn-aba');

    if (botaoClicado) {
        botaoClicado.classList.add('active');
    }

    document.querySelectorAll('.aba-conteudo').forEach((aba) => {
        aba.classList.remove('active');
    });

    const abaAlvo = document.getElementById(`aba-${nomeAba}`);

    if (abaAlvo) {
        abaAlvo.classList.add('active');
    }
}

function mudarAbaPadrao(nomeAba) {
    document.querySelectorAll('.btn-aba').forEach((btn) => {
        btn.classList.remove('active');
    });

    const abaAlvo = document.getElementById(`aba-${nomeAba}`);

    if (abaAlvo) {
        abaAlvo.classList.add('active');
    }

    document.querySelectorAll('.aba-conteudo').forEach((aba) => {
        aba.classList.remove('active');
    });

    if (abaAlvo) {
        abaAlvo.classList.add('active');
    }
}

// ========================
// CRIAR CONTA / ENTRAR
// ========================
(function () {
    const API_REGISTRO = `${API}/registrar`;

    function iniciarCadastroLogin() {
        const form = document.getElementById('form-login');
        const inputEmail = document.getElementById('login-email');
        const inputSenha = document.getElementById('login-senha');

        if (!form || !inputEmail || !inputSenha) return;

        const botaoEnviar = form.querySelector(
            'button[type="submit"], button:not([type])'
        );

        const titulo = document.querySelector('#login-screen h2');

        const textoBotaoOriginal = botaoEnviar
            ? botaoEnviar.textContent
            : 'Entrar';

        const tituloOriginal = titulo ? titulo.textContent : '';

        let modoCadastro = false;

        const blocoSenha =
            inputSenha.parentElement === form
                ? inputSenha
                : inputSenha.parentElement;

        const blocoConfirma = blocoSenha.cloneNode(true);

        const inputConfirma =
            blocoConfirma.tagName === 'INPUT'
                ? blocoConfirma
                : blocoConfirma.querySelector('input');

        if (!inputConfirma) return;

        inputConfirma.id = 'login-confirma-senha';
        inputConfirma.name = 'confirmarSenha';
        inputConfirma.value = '';
        inputConfirma.placeholder = 'Repita a senha';

        const rotulo = blocoConfirma.querySelector
            ? blocoConfirma.querySelector('label')
            : null;

        if (rotulo) {
            rotulo.textContent = 'Confirmar senha';
            rotulo.htmlFor = inputConfirma.id;
        }

        blocoConfirma.style.display = 'none';

        blocoSenha.insertAdjacentElement('afterend', blocoConfirma);

        const aviso = document.createElement('div');

        aviso.style.cssText =
            'min-height:1.2em;margin-top:12px;' +
            'font-size:0.85rem;color:#EF5350;';

        const alternar = document.createElement('button');

        alternar.type = 'button';

        alternar.style.cssText =
            'background:none;border:none;margin-top:14px;' +
            'color:var(--bright-purple);cursor:pointer;' +
            'font-size:0.9rem;text-decoration:underline;';

        form.appendChild(aviso);
        form.appendChild(alternar);

        function definirModo(cadastro) {
            modoCadastro = cadastro;

            blocoConfirma.style.display = cadastro ? '' : 'none';
            inputConfirma.required = cadastro;
            inputConfirma.value = '';

            inputSenha.autocomplete = cadastro
                ? 'new-password'
                : 'current-password';

            if (botaoEnviar) {
                botaoEnviar.textContent = cadastro
                    ? 'Criar conta'
                    : textoBotaoOriginal;
            }

            if (titulo) {
                titulo.textContent = cadastro
                    ? 'Criar conta'
                    : tituloOriginal;
            }

            alternar.textContent = cadastro
                ? 'Já tenho conta. Entrar'
                : 'Não tem conta? Criar agora';

            aviso.textContent = '';
        }

        alternar.addEventListener('click', () => {
            definirModo(!modoCadastro);
        });

        form.addEventListener('submit', async (event) => {
            if (!modoCadastro) return;

            event.preventDefault();

            const email = inputEmail.value.trim();
            const senha = inputSenha.value;

            if (!email) {
                aviso.textContent = 'Digite seu e-mail.';
                return;
            }

            if (senha.length < 6) {
                aviso.textContent =
                    'A senha deve ter pelo menos 6 caracteres.';
                return;
            }

            if (senha !== inputConfirma.value) {
                aviso.textContent = 'As senhas não conferem.';
                return;
            }

            aviso.textContent = 'Criando conta...';

            if (botaoEnviar) botaoEnviar.disabled = true;

            try {
                const resposta = await fetch(API_REGISTRO, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, senha })
                });

                const dados = await resposta.json();

                if (!resposta.ok) {
                    aviso.textContent =
                        dados.erro || 'Não foi possível criar a conta.';
                    return;
                }

                definirModo(false);

                // Tenta entrar com a conta recém-criada.
                await autenticarUsuario({
                    preventDefault() {}
                });

            } catch (error) {
                console.error('Erro ao criar conta:', error);

                aviso.textContent =
                    'Não foi possível conectar ao servidor na porta 3000.';
            } finally {
                if (botaoEnviar) botaoEnviar.disabled = false;
            }
        });

        definirModo(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            iniciarCadastroLogin
        );
    } else {
        iniciarCadastroLogin();
    }
})();