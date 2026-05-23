export const removeDuplicates = <T>(array: T[]) => {
  return array.filter((element, index) => array.indexOf(element) === index);
};
