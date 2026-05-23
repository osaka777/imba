declare module "*.svg?component" {
  import { FC, SVGProps } from "react";
  const content: FC<Record<string, string> & SVGProps<SVGElement>>;
  export default content;
}

declare module "*.svg" {
  const content: any;
  export default content;
}
