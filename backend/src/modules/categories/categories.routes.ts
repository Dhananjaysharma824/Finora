import { Router } from 'express';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import { createCategorySchema, updateCategorySchema } from './categories.schemas.js';
import { categoriesService } from './categories.service.js';

export const categoriesRouter = Router();

categoriesRouter.use(authenticateUser);

categoriesRouter.get('/', async (req, res, next) => {
  try {
    const categories = await categoriesService.list(req.user!.id);
    res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.post('/', csrfProtection, async (req, res, next) => {
  try {
    const input = createCategorySchema.parse(req.body);
    const category = await categoriesService.create(req.user!.id, input);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.patch('/:id', csrfProtection, async (req, res, next) => {
  try {
    const input = updateCategorySchema.parse(req.body);
    const category = await categoriesService.update(req.user!.id, String(req.params.id), input);
    res.status(200).json({ category });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.delete('/:id', csrfProtection, async (req, res, next) => {
  try {
    await categoriesService.remove(req.user!.id, String(req.params.id));
    res.status(200).json({ message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});
