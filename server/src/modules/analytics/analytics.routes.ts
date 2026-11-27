import { Router } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../../middleware/auth.js';
import { analyticsService } from './analytics.service.js';

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .default(() => new Date().toISOString().slice(0, 7)),
});

const analyticsRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const reportQuerySchema = z.object({
  scope: z.enum(['monthly', 'annual']).default('monthly'),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const analyticsRouter = Router();

analyticsRouter.get('/dashboard', authenticateUser, async (req, res, next) => {
  try {
    const { month } = monthQuerySchema.parse(req.query);
    const data = await analyticsService.getDashboard(req.user!.id, month);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/analytics', authenticateUser, async (req, res, next) => {
  try {
    const now = new Date();
    const defaultStart = `${now.toISOString().slice(0, 7)}-01`;
    const defaultEnd = now.toISOString().slice(0, 10);
    const { startDate, endDate } = analyticsRangeSchema.parse({
      startDate: req.query.startDate ?? defaultStart,
      endDate: req.query.endDate ?? defaultEnd,
    });
    const data = await analyticsService.getAnalytics(req.user!.id, startDate, endDate);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/reports', authenticateUser, async (req, res, next) => {
  try {
    const q = reportQuerySchema.parse(req.query);
    const periodKey =
      q.scope === 'monthly'
        ? q.month ?? new Date().toISOString().slice(0, 7)
        : q.year ?? String(new Date().getFullYear());
    const report = await analyticsService.getReport(req.user!.id, q.scope, periodKey);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/reports/export/csv', authenticateUser, async (req, res, next) => {
  try {
    const q = reportQuerySchema.parse(req.query);
    const periodKey =
      q.scope === 'monthly'
        ? q.month ?? new Date().toISOString().slice(0, 7)
        : q.year ?? String(new Date().getFullYear());
    const csv = await analyticsService.exportReportCsv(req.user!.id, q.scope, periodKey);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finora-report-${periodKey}.csv"`,
    );
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/reports/export/pdf', authenticateUser, async (req, res, next) => {
  try {
    const q = reportQuerySchema.parse(req.query);
    const periodKey =
      q.scope === 'monthly'
        ? q.month ?? new Date().toISOString().slice(0, 7)
        : q.year ?? String(new Date().getFullYear());
    const pdfBuffer = await analyticsService.exportReportPdf(req.user!.id, q.scope, periodKey);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finora-report-${periodKey}.pdf"`,
    );
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/calendar', authenticateUser, async (req, res, next) => {
  try {
    const { month } = monthQuerySchema.parse(req.query);
    const data = await analyticsService.getCalendar(req.user!.id, month);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});
