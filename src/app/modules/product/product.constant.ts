export const productSearchableFields = ["name", "description", "shortDescription", "sku"];

export const productFilterableFields = [
    "searchTerm",
    "categoryId",
    "subCategoryId",
    "childCategoryId",
    "categorySlug",
    "brandId",
    "brandSlug",
    "sellerEmail",
    "minPrice",
    "maxPrice",
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
