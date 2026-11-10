import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARQUIVO_ITENS = path.join(__dirname, '../itens.json');

export class ItemModel {
    static getAll() {
        try {
            if (!fs.existsSync(ARQUIVO_ITENS)) {
                fs.writeFileSync(ARQUIVO_ITENS, '[]', 'utf8');
                return [];
            }
            const data = fs.readFileSync(ARQUIVO_ITENS, 'utf8');
            return JSON.parse(data) || [];
        } catch (erro) {
            console.error('Erro ao ler itens:', erro);
            return [];
        }
    }

    static add(novoItem) {
        const itens = this.getAll();
        const itemFormatado = {
            id: Date.now(),
            tipo: novoItem.tipo || 'perdido',
            item: novoItem.item || novoItem.nome,
            nome: novoItem.item || novoItem.nome,
            local: novoItem.local,
            desc: novoItem.desc || novoItem.descricao || '',
            descricao: novoItem.desc || novoItem.descricao || '',
            status: novoItem.status || 'Pendente',
            dataRegistro: new Date().toISOString()
        };
        
        itens.push(itemFormatado);
        fs.writeFileSync(ARQUIVO_ITENS, JSON.stringify(itens, null, 2), 'utf8');
        return itemFormatado;
    }
}