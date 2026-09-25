// The "@bp/beacon/tour" entry: CoachTour alone, for React.lazy(() => import('@bp/beacon/tour')). The
// default export is what React.lazy expects; the named export matches the main entry.
import { CoachTour } from './CoachTour.js'

export { CoachTour, type CoachTourProps } from './CoachTour.js'
export default CoachTour
