import "server-only";

/**
 * The portfolio module: the admin portfolio and portfolio-group lifecycle
 * behind one interface, plus the public read side of the three portfolio pages.
 * This index is the module's only import point — nothing outside the module
 * should reach into `./operations`, `./groups`, `./reads`, `./slug`, or
 * `./revalidate`.
 */
export type { PortfolioInput } from "./operations";
export {
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  reorderPortfolios,
} from "./operations";
export type { GroupInput, GroupCoverInput } from "./groups";
export {
  createGroup,
  updateGroup,
  deleteGroup,
  reorderGroups,
  setGroupCover,
  assignPortfolioToGroup,
  removePortfolioFromGroup,
} from "./groups";

export type {
  FrontPageGroup,
  GroupPortfolioCard,
  PortfolioGroupView,
  PortfolioPhotoView,
  PortfolioDetailView,
} from "./reads";
export {
  getFrontPageGroups,
  getPortfolioGroup,
  getPortfolioBySlug,
  getGroupMeta,
  getPortfolioMeta,
} from "./reads";
