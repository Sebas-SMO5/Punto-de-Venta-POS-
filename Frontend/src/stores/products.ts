import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface Product {
  id: number
  name: string
  category: string
  price: number
  available: boolean
}

const STORAGE_KEY = 'restaurante-pos-products'

const initialProducts: Product[] = [
  {
    id: 1,
    name: 'Arroz con pollo',
    category: 'Platos fuertes',
    price: 18000,
    available: true,
  },
  {
    id: 2,
    name: 'Hamburguesa clásica',
    category: 'Platos fuertes',
    price: 22000,
    available: true,
  },
  {
    id: 3,
    name: 'Pizza personal',
    category: 'Platos fuertes',
    price: 20000,
    available: true,
  },
  {
    id: 4,
    name: 'Papas fritas',
    category: 'Acompañamientos',
    price: 8000,
    available: true,
  },
  {
    id: 5,
    name: 'Limonada natural',
    category: 'Bebidas',
    price: 6000,
    available: true,
  },
  {
    id: 6,
    name: 'Agua embotellada',
    category: 'Bebidas',
    price: 4000,
    available: false,
  },
]

function loadProducts(): Product[] {
  try {
    const savedProducts = localStorage.getItem(STORAGE_KEY)

    if (savedProducts !== null) {
      const parsedProducts: unknown = JSON.parse(savedProducts)

      if (Array.isArray(parsedProducts)) {
        return parsedProducts as Product[]
      }
    }
  } catch (error) {
    console.error('Error al cargar los productos:', error)
  }

  return initialProducts.map(product => ({ ...product }))
}

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>(loadProducts())

  watch(
    products,
    newProducts => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProducts))
      } catch (error) {
        console.error('Error al guardar los productos:', error)
      }
    },
    { deep: true },
  )

  function addProduct(product: Omit<Product, 'id'>) {
    const newId =
      products.value.length > 0
        ? Math.max(...products.value.map(item => item.id)) + 1
        : 1

    products.value.push({
      id: newId,
      ...product,
    })
  }

  function updateProduct(updatedProduct: Product) {
    const index = products.value.findIndex(
      product => product.id === updatedProduct.id,
    )

    if (index !== -1) {
      products.value[index] = { ...updatedProduct }
    }
  }

  function deleteProduct(id: number) {
    products.value = products.value.filter(
      product => product.id !== id,
    )
  }

  return {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
  }
})