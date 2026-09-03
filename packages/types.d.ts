declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// src/types/axios.d.ts

// axios 모듈의 타입을 가져와서 확장하겠다고 선언합니다.
import 'axios';

declare module 'axios' {
  // 기존 AxiosRequestConfig 인터페이스에 새로운 속성을 추가합니다.
  export interface AxiosRequestConfig {
    /**
     * 이 값이 true로 설정되면, 전역 에러 인터셉터가
     * 해당 요청에 한해 비활성화됩니다.
     */
    _suppressToast?: boolean;
    _suppress404Error?: boolean;
  }
}
