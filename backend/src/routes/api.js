async function cadastrarItem(dadosDoFormulario) {
    const resposta = await fetch('/api/itens', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dadosDoFormulario)
    });

    if (resposta.ok) {
        console.log('Item salvo com sucesso no itens.json!');
    } else {
        console.error('Falha ao salvar no servidor.');
    }
}

