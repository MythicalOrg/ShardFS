export const log = (...args: any[]) => {
  console.log(new Date().toISOString(), ...args);
};

export const warn = (...args: any[]) => {
  console.warn(new Date().toISOString(), "WARN:", ...args);
};

export const error = (...args: any[]) => {
  console.error(new Date().toISOString(), "ERROR:", ...args);
};
