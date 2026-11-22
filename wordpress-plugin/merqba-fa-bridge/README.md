# Merqba FA Bridge (Plugin Opcional para WordPress + Dokan Lite 5.3.3)

Merqba FA funciona directamente con los endpoints actuales de **Dokan Lite 5.3.3** sin requerir instalación adicional.  
No obstante, este micro-plugin opcional permite trasladar a WordPress la optimización de consultas SQL, filtrado en servidor (`search`, `stock_status`, `category`) y lotes autenticados directamente mediante sesión de usuario (`Cookie` + `X-WP-Nonce`) sin usar claves administrativas `wc/v3` en URL.

## Compatibilidad verificada
- WordPress 6.0+ / PHP 7.4+
- WooCommerce CRUD (`wc_get_product`, `WC_Product::save()`)
- **Dokan Lite 5.3.3** (`dokan_is_user_seller()`), sin dependencias de Dokan Pro.

## Instalación en el VPS
1. Copia la carpeta `merqba-fa-bridge` dentro de `wp-content/plugins/` de tu sitio WordPress.
2. Activa **Merqba FA Bridge (Dokan Lite REST Optimizer)** en **Plugins**.
3. Verifica en navegador o terminal que el namespace esté activo:
   `GET https://merqba.com/wp-json/merqba/v1/vendor/products` (con sesión autenticada devolverá JSON; sin sesión devolverá `401`).
