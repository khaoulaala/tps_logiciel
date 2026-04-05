package com.ecommerce.orderservice.service;

import com.ecommerce.orderservice.client.ProductClient;
import com.ecommerce.orderservice.dto.ProductDTO;
import com.ecommerce.orderservice.dto.StockUpdateRequest;
import com.ecommerce.orderservice.model.Order;
import com.ecommerce.orderservice.repository.OrderRepository;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductClient productClient;

    public List<Order> getAllOrders() {
        return orderRepository.findAll();
    }

    public Order createOrder(Long productId, Integer quantity) {
        ProductDTO product;

        try {
            product = productClient.getProductById(productId);
        } catch (FeignException.NotFound e) {
            throw new RuntimeException("Produit introuvable");
        } catch (Exception e) {
            throw new RuntimeException("Service produit indisponible");
        }

        if (product == null) {
            throw new RuntimeException("Produit introuvable");
        }

        if (quantity == null || quantity <= 0) {
            throw new RuntimeException("Quantité invalide");
        }

        if (product.getStock() < quantity) {
            throw new RuntimeException("Stock insuffisant");
        }

        try {
            productClient.updateStock(productId, new StockUpdateRequest(quantity));
        } catch (FeignException.NotFound e) {
            throw new RuntimeException("Produit introuvable");
        } catch (Exception e) {
            throw new RuntimeException("Impossible de mettre à jour le stock");
        }

        Order order = new Order();
        order.setProductId(productId);
        order.setProductName(product.getName());
        order.setQuantity(quantity);
        order.setTotalPrice(product.getPrice() * quantity);
        order.setOrderDate(LocalDateTime.now());
        order.setStatus("PENDING");

        return orderRepository.save(order);
    }
}