import "server-only";

/**
 * The portfolio module: the admin portfolio lifecycle behind one interface.
 * This index is the module's only import point — nothing outside the module
 * should reach into `./operations`, `./slug`, or `./revalidate`. (Portfolio
 * groups will be added to this surface in the next slice.)
 */
export type { PortfolioInput } from "./operations";
export {
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  reorderPortfolios,
} from "./operations";
