# iKuai Web i18n Override

Chrome extension nhỏ để bật/đổi ngôn ngữ iKuai Web UI bằng cách override các header và biến runtime mà frontend iKuai đang đọc.

## Clone repo và Thêm Địa Chỉ iKuai
```command 
git clone https://github.com/vinhnguyen2665/iKuai-web-i18n-override
```
Extension chỉ chạy trên các địa chỉ được khai báo trong [manifest.json](./manifest.json). Nếu iKuai Web UI của bạn không nằm ở các địa chỉ mặc định, cần thêm URL vào các phần sau.

Ví dụ iKuai đang ở:

```text
http://192.168.10.1/
```

thì thêm vào `host_permissions`:

```json
"host_permissions": [
    "http://192.168.1.1/*",
    "https://192.168.1.1/*",
    "http://192.168.10.1/*",
    "http://*/static/js/first.json",
    "https://*/static/js/first.json"
]
```

Thêm cùng địa chỉ vào `content_scripts.matches` để Chrome inject [content.js](./content.js):

```json
"content_scripts": [
    {
        "matches": [
            "http://192.168.1.1/*",
            "https://192.168.1.1/*",
            "http://192.168.10.1/*"
        ],
        "js": [
            "content.js"
        ],
        "run_at": "document_start"
    }
]
```

Thêm cùng địa chỉ vào `web_accessible_resources.matches` để page có thể load [inject.js](./inject.js):

```json
"web_accessible_resources": [
    {
        "resources": [
            "inject.js"
        ],
        "matches": [
            "http://192.168.1.1/*",
            "https://192.168.1.1/*",
            "http://192.168.10.1/*"
        ]
    }
]
```

Nếu dùng domain reverse proxy, ví dụ:

```text
https://ikuai.example.com/
```

thì thêm:

```json
"https://ikuai.example.com/*"
```

vào cả 3 nơi trên.


## Cài Đặt Extension

1. Mở Chrome/Chromium.
2. Vào `chrome://extensions`.
3. Bật `Developer mode`.
4. Chọn `Load unpacked`.
5. Chọn thư mục repo này.
6. Mở iKuai Web UI, chọn ngôn ngữ trong popup extension rồi bấm `Save`.

Sau khi bấm `Save`, extension sẽ lưu cấu hình, cập nhật rule và reload tab hiện tại.

## Nguyên Lý

iKuai Web UI đã có sẵn cơ chế i18n ở phía frontend. Khi tải file cấu hình ban đầu, thường là:

```text
/static/js/first.json
```

frontend đọc các response header như:

```text
x-lang
x-support-i18n
```

và đưa chúng vào biến runtime tương tự:

```js
window.headers.xLang
window.headers.xSupportI18n
```

Một đoạn logic trong source web có dạng:

```js
window.headers.xSupportI18n =
    void 0 != e.headers["x-support-i18n"]
        ? 1 * e.headers["x-support-i18n"]
        : 0;
```

Nghĩa là nếu response có `x-support-i18n: 1`, frontend hiểu rằng i18n được hỗ trợ. Nếu header này không có, hoặc giá trị là `0`, phần đổi ngôn ngữ có thể bị ẩn/tắt dù code i18n vẫn tồn tại trong web UI.

Header `x-lang` dùng để chọn ngôn ngữ:

```text
x-lang: 1    zh-CN
x-lang: 2    en-US
x-lang: 3    zh-TW
```

Vì vậy extension này không dịch lại giao diện. Nó chỉ ép các tín hiệu mà frontend iKuai vốn đã hỗ trợ:

- `x-lang` để chọn ngôn ngữ.
- `x-support-i18n` để bật trạng thái hỗ trợ i18n.
- `window.headers.xLang` và `window.headers.xSupportI18n` để xử lý trường hợp frontend đã cache header vào biến global.

## Cách Extension Override

Extension can thiệp ở nhiều lớp để tăng khả năng hoạt động với các phiên bản iKuai khác nhau.

### 1. declarativeNetRequest

[background.js](./background.js) dùng Chrome `declarativeNetRequest` để sửa response header của request tới:

```text
/static/js/first.json
```

Ví dụ khi chọn English:

```text
x-lang: 2
```

Khi bật override i18n support:

```text
x-support-i18n: 1
```

Đây là lớp gần network nhất trong extension.

### 2. Inject Script

[content.js](./content.js) inject [inject.js](./inject.js) vào page context ở `document_start`.

`inject.js` hook các API mà frontend có thể dùng để đọc header:

- `XMLHttpRequest.prototype.getResponseHeader`
- `XMLHttpRequest.prototype.getAllResponseHeaders`
- `window.fetch`

Ngoài ra script còn patch:

```js
window.headers.xLang
window.headers.xSupportI18n
```

Điểm này cần thiết vì một số source web đọc header một lần, sau đó lưu vào `window.headers`. Nếu chỉ sửa network header mà page đã cache giá trị cũ, giao diện vẫn có thể không đổi.

### 3. Tránh Duplicate Header

Nếu cùng lúc Chrome DNR đã set `x-lang`, rồi `getAllResponseHeaders()` lại append thêm một dòng `x-lang`, source web có thể thấy giá trị dạng:

```text
1, 1
```

Do browser hoặc parser gộp nhiều header cùng tên bằng dấu phẩy. Vì vậy `inject.js` dùng logic upsert: xóa header cũ cùng tên trong chuỗi header rồi thêm lại đúng một dòng.


## Override Bằng Reverse Proxy

Nếu không muốn dùng Chrome extension, có thể override header ở tầng reverse proxy, ví dụ Nginx. Cách này phù hợp khi truy cập iKuai thông qua một domain/proxy riêng.

Ví dụ:

```nginx
server {
    listen 80;
    server_name ikuai.local;

    location / {
        proxy_pass http://192.168.1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /static/js/first.json {
        proxy_pass http://192.168.1.1/static/js/first.json;

        proxy_hide_header x-lang;
        proxy_hide_header x-support-i18n;

        add_header x-lang 2 always;
        add_header x-support-i18n 1 always;
    }
}
```

Trong ví dụ trên:

- `proxy_hide_header` bỏ header cũ từ iKuai để tránh duplicate.
- `add_header x-lang 2 always` ép English.
- `add_header x-support-i18n 1 always` bật flag hỗ trợ i18n.

Nếu muốn chọn ngôn ngữ khác:

```nginx
add_header x-lang 1 always; # zh-CN
add_header x-lang 2 always; # en-US
add_header x-lang 3 always; # zh-TW
```

Lưu ý chỉ nên set một dòng `x-lang` tại một thời điểm.

## Extension Và Proxy Khác Nhau Thế Nào?

Extension:

- Dễ thử nghiệm, không cần đổi network topology.
- Có thể patch thêm `window.headers` và API đọc header trong page.
- Chỉ tác động trên trình duyệt đã cài extension.

Reverse proxy:

- Tác động cho mọi client đi qua proxy.
- Sạch ở tầng HTTP response header.
- Không patch được biến runtime như `window.headers` nếu frontend đã tự ghi đè sau đó.

Nếu proxy đã override header đúng từ đầu trước khi frontend tải `first.json`, thường không cần extension. Nếu source web còn cache hoặc sửa `window.headers` ở runtime, extension vẫn linh hoạt hơn.
