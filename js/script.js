// Dados de exemplo
const dadosCarteira = {
    patrimonioTotal: 150000,
    ativos: [
        {
            nome: 'PETR4',
            quantidade: 100,
            precoMedio: 28.50,
            precoAtual: 32.40
        },
        {
            nome: 'ITUB4', 
            quantidade: 200,
            precoMedio: 24.30,
            precoAtual: 25.80
        }
    ],
    composicao: {
        acoes: 40,
        rendaFixa: 30,
        fundosImobiliarios: 20,
        tesouro: 10
    },
    evolucaoPatrimonial: [120000, 125000, 128000, 135000, 142000, 150000],
    patrimonioImobiliario: [],
    historicoInvestimentos: []
};

// Função para buscar preço atual da ação via API do Google Finance
async function buscarPrecoAtual(simbolo) {
    try {
        const response = await fetch(`https://www.googleapis.com/finance/v1/quotes?q=${simbolo}&fields=latestPrice`);
        const data = await response.json();
        return data.latestPrice;
    } catch (error) {
        console.error('Erro ao buscar preço:', error);
        return null;
    }
}

// Função para buscar lista de ações disponíveis
async function buscarAcoesDisponiveis(termo) {
    try {
        const response = await fetch(`https://www.googleapis.com/finance/v1/search?q=${termo}`);
        const data = await response.json();
        return data.matches || [];
    } catch (error) {
        console.error('Erro ao buscar ações:', error);
        return [];
    }
}

function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function calcularRentabilidade(precoAtual, precoMedio) {
    return ((precoAtual - precoMedio) / precoMedio * 100).toFixed(2);
}

function calcularRendimentoMensal() {
    let rendimentoAtivos = dadosCarteira.ativos.reduce((total, ativo) => {
        return total + (ativo.quantidade * ativo.precoAtual * 0.005);
    }, 0);
    
    let rendimentoImoveis = dadosCarteira.patrimonioImobiliario.reduce((total, imovel) => {
        return total + imovel.rendaMensal;
    }, 0);
    
    return rendimentoAtivos + rendimentoImoveis;
}

function calcularEconomiaMensal() {
    const historicoLength = dadosCarteira.historicoInvestimentos.length;
    if (historicoLength === 0) {
        const evolucao = dadosCarteira.evolucaoPatrimonial;
        let diferencaTotal = 0;
        
        for(let i = 1; i < evolucao.length; i++) {
            const diferenca = evolucao[i] - evolucao[i-1];
            diferencaTotal += diferenca - calcularRendimentoMensal();
        }
        
        return Math.max(0, diferencaTotal / (evolucao.length - 1));
    }
    
    const mesesParaCalcular = Math.min(6, historicoLength);
    const investimentosRecentes = dadosCarteira.historicoInvestimentos.slice(-mesesParaCalcular);
    
    return investimentosRecentes.reduce((total, valor) => total + valor, 0) / mesesParaCalcular;
}

function editarPatrimonio(e) {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const novoPatrimonio = parseFloat(input.value.replace(/[^\d,.-]/g, '').replace(',', '.'));
    
    if (!isNaN(novoPatrimonio) && novoPatrimonio > 0) {
        dadosCarteira.patrimonioTotal = novoPatrimonio;
        dadosCarteira.evolucaoPatrimonial.push(novoPatrimonio);
        
        // Atualiza o elemento HTML que mostra o patrimônio total
        document.getElementById('patrimonioTotal').textContent = formatarMoeda(novoPatrimonio);
        
        atualizarCards();
        const modal = bootstrap.Modal.getInstance(document.getElementById('editarPatrimonioModal'));
        modal.hide();
        
        // Limpa o input
        input.value = '';
    } else {
        alert('Por favor, insira um valor válido para o patrimônio');
    }
}

function atualizarCards() {
    const rendimentoMensal = calcularRendimentoMensal();
    const economiaMensal = calcularEconomiaMensal();
    
    document.getElementById('patrimonioTotal').textContent = formatarMoeda(dadosCarteira.patrimonioTotal);
    document.querySelectorAll('.card-text')[1].textContent = formatarMoeda(rendimentoMensal);
    document.querySelectorAll('.card-text')[2].textContent = formatarMoeda(economiaMensal);
}

async function atualizarTabelaAtivos() {
    const tbody = document.querySelector('tbody');
    tbody.innerHTML = '';
    
    for (const ativo of dadosCarteira.ativos) {
        // Atualiza preço atual via API
        const precoAtualizado = await buscarPrecoAtual(ativo.nome);
        if (precoAtualizado) {
            ativo.precoAtual = precoAtualizado;
        }
        
        const rentabilidade = calcularRentabilidade(ativo.precoAtual, ativo.precoMedio);
        const valorTotal = ativo.quantidade * ativo.precoAtual;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${ativo.nome}</td>
            <td>${ativo.quantidade}</td>
            <td>${formatarMoeda(ativo.precoMedio)}</td>
            <td>${formatarMoeda(ativo.precoAtual)}</td>
            <td class="${rentabilidade >= 0 ? 'text-success' : 'text-danger'}">
                ${rentabilidade >= 0 ? '+' : ''}${rentabilidade}%
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="abrirModalEditarAtivo('${ativo.nome}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="excluirAtivo('${ativo.nome}')">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

function abrirModalEditarAtivo(nomeAtivo) {
    const ativo = dadosCarteira.ativos.find(a => a.nome === nomeAtivo);
    if (ativo) {
        const modal = new bootstrap.Modal(document.getElementById('editarAtivoModal'));
        const form = document.getElementById('formEditarAtivo');
        
        form.querySelector('input[name="nome"]').value = ativo.nome;
        form.querySelector('input[name="quantidade"]').value = ativo.quantidade;
        form.querySelector('input[name="precoMedio"]').value = ativo.precoMedio;
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const novoNome = form.querySelector('input[name="nome"]').value;
            const novaQuantidade = parseInt(form.querySelector('input[name="quantidade"]').value);
            const novoPrecoMedio = parseFloat(form.querySelector('input[name="precoMedio"]').value);
            
            // Verifica se o novo ativo existe
            const precoAtual = await buscarPrecoAtual(novoNome);
            if (!precoAtual) {
                alert('Ativo não encontrado!');
                return;
            }
            
            // Atualiza o ativo
            const index = dadosCarteira.ativos.findIndex(a => a.nome === nomeAtivo);
            dadosCarteira.ativos[index] = {
                nome: novoNome,
                quantidade: novaQuantidade,
                precoMedio: novoPrecoMedio,
                precoAtual: precoAtual
            };
            
            await atualizarTabelaAtivos();
            atualizarCards();
            modal.hide();
        };
        
        modal.show();
    }
}

function excluirAtivo(nomeAtivo) {
    if (confirm('Tem certeza que deseja excluir este ativo?')) {
        dadosCarteira.ativos = dadosCarteira.ativos.filter(a => a.nome !== nomeAtivo);
        atualizarTabelaAtivos();
        atualizarCards();
    }
}

// Função para buscar e sugerir ações ao digitar
async function sugerirAcoes(input) {
    const resultados = await buscarAcoesDisponiveis(input.value);
    const listaSugestoes = document.getElementById('sugestoesAcoes');
    
    listaSugestoes.innerHTML = '';
    resultados.forEach(acao => {
        const item = document.createElement('div');
        item.className = 'sugestao-item';
        item.textContent = `${acao.symbol} - ${acao.name}`;
        item.onclick = () => {
            input.value = acao.symbol;
            listaSugestoes.innerHTML = '';
        };
        listaSugestoes.appendChild(item);
    });
}

// Inicializar dados e event listeners
document.addEventListener('DOMContentLoaded', () => {
    atualizarCards();
    atualizarTabelaAtivos();
    atualizarTabelaImoveis();
    
    // Adiciona autocomplete para busca de ações
    const inputAcao = document.querySelector('input[name="nome"]');
    if (inputAcao) {
        inputAcao.addEventListener('input', () => sugerirAcoes(inputAcao));
    }
    
    document.getElementById('formEditarPatrimonio').addEventListener('submit', editarPatrimonio);
    document.getElementById('formAdicionarAtivo').addEventListener('submit', adicionarAtivo);
    
    const formImovel = document.querySelector('#adicionarImovelModal form');
    if (formImovel) {
        formImovel.addEventListener('submit', adicionarImovel);
    }
});

// Atualizar dados periodicamente (a cada 5 minutos)
setInterval(async () => {
    await atualizarTabelaAtivos();
    atualizarCards();
    atualizarTabelaImoveis();
}, 300000);
