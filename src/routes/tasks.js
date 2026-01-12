const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware.verifyToken, taskController.getTasks);
router.post('/', authMiddleware.verifyToken, taskController.createTask);
router.put('/:id', authMiddleware.verifyToken, taskController.updateTask);
router.delete('/:id', authMiddleware.verifyToken, taskController.deleteTask);

module.exports = router;
