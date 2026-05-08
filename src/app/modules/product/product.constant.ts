export const productSearchableFields = ["name", "description", "shortDescription", "sku"];

export const productFilterableFields = [
    "searchTerm",
    "categoryId",
    "categoryIds",
    "subCategoryId",
    "childCategoryId",
    "categorySlug",
    "brandId",
    "brandIds",
    "brandSlug",
    "sellerEmail",
    "minPrice",
    "maxPrice",
    "priceRanges",
    "minRating",
    "inStock",
    "status",
];

export const sellerProductFilterableFields = [
    "searchTerm",
    "status",
    "categoryId",
    "inStock",
];

export const categoryFilterableFields = ["searchTerm", "parentId"];
export const brandFilterableFields = ["searchTerm"];
