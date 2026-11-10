const API_URL = 'http://localhost:3000/api';

async function fetchItems() {
    try {
        const res = await fetch(`${API_URL}/itens`);
        return await res.json();
    } catch (e) {
        console.error('Erro ao buscar itens:', e);
        return [];
    }
}

async function createItem(item) {
    try {
        const res = await fetch(`${API_URL}/itens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        return await res.json();
    } catch (e) {
        console.error('Erro ao criar item:', e);
        return null;
    }
}