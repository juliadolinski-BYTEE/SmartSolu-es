import { ItemModel } from '../models/itemModel.js';

export const getItens = (req, res) => {
    const itens = ItemModel.getAll();
    return res.json(itens);
};

export const createItem = (req, res) => {
    const { item, nome, local, desc, descricao, tipo } = req.body;
    const nomeFinal = item || nome;

    if (!nomeFinal || !local) {
        return res.status(400).json({ erro: 'Nome e local são obrigatórios.' });
    }

    const novoItem = ItemModel.add({ item: nomeFinal, local, desc: desc || descricao, tipo });
    return res.status(201).json({ sucesso: true, item: novoItem });
};