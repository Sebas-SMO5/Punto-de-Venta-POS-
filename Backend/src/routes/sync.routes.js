
import { Router } from 'express'
import {
  synchronizeOperations,
  getSyncStatus
} from '../controllers/sync.controller.js'

const router = Router()

router.post('/', synchronizeOperations)
router.get('/status', getSyncStatus)

export default router
