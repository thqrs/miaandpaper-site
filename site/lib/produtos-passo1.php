<?php
/**
 * Contratos de edição dos items do PASSO 1 em produtos.php.
 *
 * Não há fallback genérico de propósito. Cada JSON activo tem de ter uma
 * receita explícita: defaults visuais, política de imagem e efeitos que tornam
 * a criação/remoção segura. Um slug sem receita fica bloqueado na interface.
 *
 * Ao acrescentar um produto ou mudar a estrutura dos items do seu PASSO 1,
 * actualizar esta tabela na mesma alteração. Ver também AGENTS.md.
 */

function pd_passo1_receitas()
{
    return array(
        'agendas' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('modelos-1', 'modelos-2'),
            'imageRequired' => true,
            'note' => 'Capa vertical 120 × 147, organizada pelas duas secções de modelos.',
            'defaults' => array('badge' => 'Imagem', 'visual' => 'neutral', 'imageFit' => 'cover', 'frameWidth' => 120, 'frameHeight' => 147),
        ),
        'blocos-a6' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades', 'felicidade-eterna'),
            'imageRequired' => true,
            'note' => 'Capa vertical com moldura de 125 px.',
            'defaults' => array('badge' => '', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'frameHeight' => 125, 'rectOrientation' => 'portrait'),
        ),
        'bloquinhos' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades'),
            'imageRequired' => true,
            'note' => 'Design vertical simples, sem imagens auxiliares.',
            'defaults' => array('badge' => '', 'visual' => 'neutral', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'rectOrientation' => 'portrait'),
        ),
        'cadernos-anuais' => array(
            'stepId' => 'designs', 'strategy' => 'caderno-anual', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image', 'laminationImages.matte', 'interiorImages.0'),
            'expectedSections' => array('novidades', 'felicidade-eterna'),
            'imageRequired' => true,
            'note' => 'Cada capa exige imagens próprias para quatro laminações e quatro opções de compra. A imagem principal serve também de matte e de interior.',
            'defaults' => array('badge' => '', 'visual' => 'neutral', 'imageFit' => 'cover', 'frameWidth' => 120, 'frameHeight' => 147, 'imageEdits' => array()),
            'extraImages' => array(
                array('name' => 'glossy', 'label' => 'Laminação glossy', 'group' => 'laminationImages', 'key' => 'glossy'),
                array('name' => 'holografico', 'label' => 'Laminação holográfica', 'group' => 'laminationImages', 'key' => 'holografico'),
                array('name' => 'glitter', 'label' => 'Laminação glitter', 'group' => 'laminationImages', 'key' => 'glitter'),
                array('name' => 'caderno_normal', 'label' => 'Compra: caderno normal', 'group' => 'purchaseOptionImages', 'key' => 'caderno_normal'),
                array('name' => 'caderno_pioneiro', 'label' => 'Compra: caderno pioneiro', 'group' => 'purchaseOptionImages', 'key' => 'caderno_pioneiro'),
                array('name' => 'pack_normal', 'label' => 'Compra: pack normal', 'group' => 'purchaseOptionImages', 'key' => 'pack_normal'),
                array('name' => 'pack_pioneiro', 'label' => 'Compra: pack pioneiro', 'group' => 'purchaseOptionImages', 'key' => 'pack_pioneiro'),
            ),
        ),
        'crachas-loja' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades', 'porto-2026', 'restelo', 'criancas', 'felicidade-eterna'),
            'imageRequired' => true,
            'note' => 'Crachá com moldura ampliada; a secção controla o agrupamento e o nome apresentado.',
            'defaults' => array('visual' => 'neutral', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 130, 'frameMarginX' => 0, 'frameMarginY' => 10),
        ),
        'porta-chaves' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades', 'porto-2026', 'restelo', 'criancas', 'felicidade-eterna'),
            'imageRequired' => true,
            'note' => 'Porta-chaves redondo: catálogo e enquadramento seguem a família dos crachás.',
            'defaults' => array('visual' => 'neutral', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 130, 'frameMarginX' => 0, 'frameMarginY' => 10),
        ),
        'pasta-de-folhetos' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => false, 'allowRemove' => false, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array(),
            'imageRequired' => true,
            'note' => 'O fluxo público simples tem tamanho, design, acabamento e detalhes; no PACK, cada design e cada acabamento abre uma pré-visualização onde se atribui a escolha ao A4, ao A6 ou aos dois, e os detalhes dos dois tamanhos ficam no mesmo passo. As mesmas 13 capas existem nos dois tamanhos e este editor mantém as fotografias finais de fita/argolas no passo de dados designs. Criar ou remover exige replicar a capa nos grupos A4 e A6, ligar todas as variações e actualizar o mapa de atribuição entre tamanhos, por isso fica bloqueado. Uma fotografia existente pode ser substituída diretamente.',
            'defaults' => array('visual' => 'neutral', 'imageFit' => 'contain', 'frameWidth' => 96, 'frameHeight' => 120),
        ),
        'imanes-loja' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades', 'verticais', 'horizontais'),
            'imageRequired' => true,
            'note' => 'Íman vertical 95 × 120; a secção separa novidades, verticais e horizontais.',
            'defaults' => array('badge' => '', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'frameWidth' => 95, 'frameHeight' => 120, 'rectOrientation' => 'portrait'),
        ),
        'imanes-recortados' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades'),
            'imageRequired' => true,
            'note' => 'Design vertical simples, sem imagens auxiliares.',
            'defaults' => array('badge' => '', 'visual' => 'neutral', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'rectOrientation' => 'portrait'),
        ),
        'marcadores-magneticos' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades'),
            'imageRequired' => true,
            'note' => 'Marcador magnético vertical simples, sem imagens auxiliares.',
            'defaults' => array('badge' => '', 'visual' => 'neutral', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'rectOrientation' => 'portrait'),
        ),
        'marcadores' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades'),
            'imageRequired' => true,
            'note' => 'Marcador vertical simples, sem imagens auxiliares.',
            'defaults' => array('badge' => '', 'visual' => 'neutral', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'rectOrientation' => 'portrait'),
        ),
        'mini-cadernos' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades', 'felicidade-eterna'),
            'imageRequired' => true,
            'note' => 'Capa vertical com moldura de 125 px.',
            'defaults' => array('badge' => '', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'frameHeight' => 125, 'rectOrientation' => 'portrait'),
        ),
        'quadros' => array(
            'stepId' => 'designs', 'strategy' => 'conditional-flow', 'allowCreate' => false, 'allowRemove' => false, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array(),
            'imageRequired' => true,
            'note' => 'Bloqueado aqui: cada tipo de moldura tem preço, gaveta e passos condicionais ligados ao value. Tem de ser alterado como percurso completo no JSON e verificado no checkout.',
            'defaults' => array('imageFit' => 'contain', 'imageZoom' => 60, 'frameWidth' => 96, 'frameHeight' => 76, 'rectOrientation' => 'landscape', 'drawerImages' => array()),
        ),
        'stickers' => array(
            'stepId' => 'designs', 'strategy' => 'standard', 'allowCreate' => true, 'allowRemove' => true, 'allowDirectUpload' => true,
            'directUploadTargets' => array('image'),
            'expectedSections' => array('novidades'),
            'imageRequired' => true,
            'note' => 'Sticker vertical simples, sem imagens auxiliares.',
            'defaults' => array('badge' => '', 'visual' => 'neutral', 'imageFit' => 'contain', 'imageZoom' => 100, 'imagePositionX' => 0, 'imagePositionY' => 0, 'imageRotation' => 0, 'frameScale' => 100, 'frameMarginX' => 0, 'frameMarginY' => 0, 'rectOrientation' => 'portrait'),
        ),
    );
}
