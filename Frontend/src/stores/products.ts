
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { productsService } from '../services/products.service'

export interface Product {
  id: number
  name: string
  category: string
  price: number
  available: boolean
}

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const isLoading = ref(false)

  async function loadProducts() {
    isLoading.value = true

    try {
      products.value = await productsService.getAll()
    } catch (error) {
      console.error('Error al cargar productos:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  function addProduct(product: Omit<Product, 'id'>) {
    const newId = products.value.length > 0
      ? Math.max(...products.value.map(item => item.id)) + 1
      : 1

    products.value.push({
      id: newId,
      ...product
    })
  }

  function updateProduct(updatedProduct: Product) {
    const index = products.value.findIndex(
      product => product.id === updatedProduct.id
    )

    if (index !== -1) {
      products.value[index] = { ...updatedProduct }
    }
  }

  function deleteProduct(id: number) {
    products.value = products.value.filter(
      product => product.id !== id
    )
  }

  return {
    products,
    isLoading,
    loadProducts,
    addProduct,
    updateProduct,
    deleteProduct
  }
})
