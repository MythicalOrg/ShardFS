import open from 'open';
import { DASHBOARD_URL } from '../config';
const dashboard = async() => {
    open(DASHBOARD_URL);
}
export default dashboard;