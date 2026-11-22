<?php
/**
 * Plugin Name: Merqba FA Bridge (Dokan Lite REST Optimizer)
 * Description: Endpoint ligero autenticado por sesión WordPress para aislamiento estricto de vendedores en Dokan Lite 5.3.3, filtrado en servidor estilo WEPOS y lotes sin credenciales globales en URL.
 * Version: 1.0.0
 * Requires PHP: 7.4
 * Requires at least: 6.0
 * Author: Merqba
 * License: GPL-2.0+
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Merqba_FA_Bridge_Controller {

    const NAMESPACE_V1 = 'merqba/v1';

    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    public static function register_routes() {
        register_rest_route(
            self::NAMESPACE_V1,
            '/vendor/products',
            array(
                array(
                    'methods'             => WP_REST_Server::READABLE,
                    'callback'            => array( __CLASS__, 'get_vendor_products' ),
                    'permission_callback' => array( __CLASS__, 'check_vendor_permission' ),
                    'args'                => array(
                        'page'         => array( 'type' => 'integer', 'default' => 1, 'minimum' => 1 ),
                        'per_page'     => array( 'type' => 'integer', 'default' => 50, 'minimum' => 1, 'maximum' => 100 ),
                        'search'       => array( 'type' => 'string', 'default' => '' ),
                        'stock_status' => array( 'type' => 'string', 'enum' => array( 'instock', 'outofstock', 'onbackorder', '' ), 'default' => '' ),
                        'category'     => array( 'type' => 'string', 'default' => '' ),
                    ),
                ),
            )
        );

        register_rest_route(
            self::NAMESPACE_V1,
            '/vendor/products/batch',
            array(
                array(
                    'methods'             => WP_REST_Server::EDITABLE,
                    'callback'            => array( __CLASS__, 'batch_update_vendor_products' ),
                    'permission_callback' => array( __CLASS__, 'check_vendor_permission' ),
                ),
            )
        );
    }

    /**
     * Resolve vendor ID strictly from authenticated WordPress user (adapted from WEPOS, Dokan Lite compatible).
     */
    public static function get_authenticated_vendor_id() {
        $user_id = get_current_user_id();
        if ( ! $user_id ) {
            return 0;
        }
        if ( function_exists( 'dokan_is_user_seller' ) && dokan_is_user_seller( $user_id ) ) {
            return (int) $user_id;
        }
        if ( current_user_can( 'manage_woocommerce' ) ) {
            return (int) $user_id;
        }
        return 0;
    }

    public static function check_vendor_permission() {
        if ( ! is_user_logged_in() ) {
            return new WP_Error( 'merqba_unauthorized', __( 'Sesión requerida.', 'merqba-fa' ), array( 'status' => 401 ) );
        }
        $vendor_id = self::get_authenticated_vendor_id();
        if ( $vendor_id <= 0 ) {
            return new WP_Error( 'merqba_forbidden', __( 'La cuenta no corresponde a una tienda activa.', 'merqba-fa' ), array( 'status' => 403 ) );
        }
        return true;
    }

    /**
     * Server-side filtered product query using native WC_Product_Query restricted by author = vendor_id.
     */
    public static function get_vendor_products( WP_REST_Request $request ) {
        $vendor_id    = self::get_authenticated_vendor_id();
        $page         = max( 1, (int) $request->get_param( 'page' ) );
        $per_page     = min( 100, max( 1, (int) $request->get_param( 'per_page' ) ) );
        $search       = sanitize_text_field( (string) $request->get_param( 'search' ) );
        $stock_status = sanitize_text_field( (string) $request->get_param( 'stock_status' ) );
        $category     = sanitize_text_field( (string) $request->get_param( 'category' ) );

        $args = array(
            'post_type'      => 'product',
            'post_status'    => array( 'publish', 'pending', 'draft' ),
            'author'         => $vendor_id,
            'posts_per_page' => $per_page,
            'paged'          => $page,
            'orderby'        => 'title',
            'order'          => 'ASC',
        );

        if ( '' !== $search ) {
            $args['s'] = $search;
        }

        if ( '' !== $stock_status ) {
            $args['meta_query'] = array(
                array(
                    'key'   => '_stock_status',
                    'value' => $stock_status,
                ),
            );
        }

        if ( '' !== $category ) {
            $args['tax_query'] = array(
                array(
                    'taxonomy' => 'product_cat',
                    'field'    => 'name',
                    'terms'    => $category,
                ),
            );
        }

        $query = new WP_Query( $args );
        $items = array();

        foreach ( $query->posts as $post ) {
            $product = wc_get_product( $post->ID );
            if ( ! $product ) {
                continue;
            }
            $image_id  = $product->get_image_id();
            $image_url = $image_id ? wp_get_attachment_image_url( $image_id, 'woocommerce_thumbnail' ) : '';
            $cat_names = wp_get_post_terms( $post->ID, 'product_cat', array( 'fields' => 'names' ) );

            $items[] = array(
                'id'            => (int) $product->get_id(),
                'vendorId'      => $vendor_id,
                'name'          => $product->get_name(),
                'slug'          => $product->get_slug(),
                'permalink'     => get_permalink( $post->ID ),
                'sku'           => $product->get_sku(),
                'price'         => (float) $product->get_price(),
                'regularPrice'  => (float) $product->get_regular_price(),
                'salePrice'     => '' !== $product->get_sale_price() ? (float) $product->get_sale_price() : null,
                'stockQuantity' => (int) $product->get_stock_quantity(),
                'stockStatus'   => $product->get_stock_status(),
                'manageStock'   => (bool) $product->get_manage_stock(),
                'imageUrl'      => $image_url ? $image_url : '',
                'category'      => ! is_wp_error( $cat_names ) && ! empty( $cat_names ) ? $cat_names[0] : 'General',
                'lastModified'  => get_post_modified_time( 'c', true, $post->ID ),
            );
        }

        $response = rest_ensure_response( $items );
        $response->header( 'X-WP-Total', (int) $query->found_posts );
        $response->header( 'X-WP-TotalPages', (int) $query->max_num_pages );
        return $response;
    }

    /**
     * Ownership-verified batch update (max 50 items) using native WC_Product CRUD.
     */
    public static function batch_update_vendor_products( WP_REST_Request $request ) {
        $vendor_id = self::get_authenticated_vendor_id();
        $body      = $request->get_json_params();
        $updates   = isset( $body['update'] ) && is_array( $body['update'] ) ? array_slice( $body['update'], 0, 50 ) : array();

        $succeeded = array();
        $failed    = array();

        foreach ( $updates as $item ) {
            $product_id = isset( $item['id'] ) ? (int) $item['id'] : 0;
            if ( $product_id <= 0 ) {
                continue;
            }

            $post_author = (int) get_post_field( 'post_author', $product_id );
            if ( $post_author !== $vendor_id ) {
                $failed[] = array( 'id' => $product_id, 'error' => 'Permiso denegado sobre el producto.' );
                continue;
            }

            $product = wc_get_product( $product_id );
            if ( ! $product ) {
                $failed[] = array( 'id' => $product_id, 'error' => 'Producto no encontrado.' );
                continue;
            }

            if ( isset( $item['name'] ) ) {
                $product->set_name( sanitize_text_field( $item['name'] ) );
            }
            if ( isset( $item['regular_price'] ) ) {
                $product->set_regular_price( wc_format_decimal( $item['regular_price'] ) );
            }
            if ( array_key_exists( 'sale_price', $item ) ) {
                $product->set_sale_price( '' === $item['sale_price'] || null === $item['sale_price'] ? '' : wc_format_decimal( $item['sale_price'] ) );
            }
            if ( isset( $item['stock_quantity'] ) ) {
                $qty = max( 0, (int) $item['stock_quantity'] );
                $product->set_manage_stock( true );
                $product->set_stock_quantity( $qty );
                $product->set_stock_status( $qty > 0 ? 'instock' : 'outofstock' );
            } elseif ( isset( $item['stock_status'] ) ) {
                $status = 'instock' === $item['stock_status'] ? 'instock' : 'outofstock';
                $product->set_stock_status( $status );
            }

            $product->save();
            $succeeded[] = $product_id;
        }

        return rest_ensure_response(
            array(
                'success'      => empty( $failed ),
                'succeededIds' => $succeeded,
                'failedItems'  => $failed,
            )
        );
    }
}

Merqba_FA_Bridge_Controller::init();
